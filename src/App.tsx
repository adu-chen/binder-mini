import { useState } from "react";
import { createAgentMachineDefinition } from "./machines/agentMachine";
import { createDiffMachineDefinition } from "./machines/diffMachine";
import { createEditorMachineDefinition } from "./machines/editorMachine";
import { createWorkspaceMachineDefinition } from "./machines/workspaceMachine";
import {
  canRecordAgentMessage,
  canSendAgentMessage,
  createAssistantStreamMessage,
  createPendingToolExecution,
  createUserAgentMessage,
  executeListFilesTool,
  executeReadFileTool,
  executeSearchFilesTool,
  normalizeProviderConfig,
  streamAssistantResponse,
} from "./services/agentService";
import {
  canSaveEditorDocument,
  openEditorDocument,
  saveEditorDocument,
} from "./services/editorService";
import type { AgentMessage, ProviderConfig, ToolExecution } from "./types/agent";
import { openWorkspace, sortWorkspaceEntries } from "./services/workspaceService";
import type { EditorDocument } from "./types/editor";
import type { WorkspaceSnapshot } from "./types/workspace";

/**
 * @GOV
 * codes: BR-SYS-GOV-001-RB-SYS-WS-OPEN-001,
 *        BR-CORE-GOV-001-RB-SYS-WS-OPEN-001
 * type: RB
 * chain: WS-OPEN, ED-OPEN-FILE, AG-SEND-MESSAGE, DE-CREATE-DIFF
 * rules: BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=registered machine definitions | out=application shell sections | delegate=workspaceMachine,editorMachine,agentMachine,diffMachine
 */
export default function App() {
  const [workspaceSnapshot, setWorkspaceSnapshot] =
    useState<WorkspaceSnapshot | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [editorDocument, setEditorDocument] = useState<EditorDocument | null>(
    null,
  );
  const [editorError, setEditorError] = useState<string | null>(null);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    provider: "openai",
    model: "",
    apiKeyConfigured: false,
  });
  const [agentInput, setAgentInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentStreaming, setAgentStreaming] = useState(false);
  const machines = [
    createWorkspaceMachineDefinition(),
    createEditorMachineDefinition(),
    createAgentMachineDefinition(),
    createDiffMachineDefinition(),
  ];

  async function handleOpenWorkspace() {
    setWorkspaceError(null);
    try {
      const result = await openWorkspace();
      if (!result.cancelled && result.snapshot) {
        setWorkspaceSnapshot({
          ...result.snapshot,
          entries: sortWorkspaceEntries(result.snapshot.entries),
        });
        setEditorDocument(null);
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleOpenFile(relativePath: string) {
    if (!workspaceSnapshot) return;
    setEditorError(null);
    try {
      setEditorDocument(
        await openEditorDocument({
          workspaceRoot: workspaceSnapshot.workspace.rootPath,
          relativePath,
        }),
      );
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSaveFile() {
    if (!editorDocument) return;
    setEditorError(null);
    try {
      setEditorDocument(await saveEditorDocument(editorDocument));
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSendAgentMessage() {
    if (agentStreaming) return;
    const normalizedProvider = normalizeProviderConfig(providerConfig);
    setProviderConfig(normalizedProvider);
    setAgentError(null);

    if (!canSendAgentMessage(normalizedProvider)) {
      setAgentError("Provider configuration is required before sending.");
      return;
    }
    if (!canRecordAgentMessage(agentInput)) {
      setAgentError("Message cannot be empty.");
      return;
    }

    const userContent = agentInput;
    const userMessage = createUserAgentMessage(userContent);
    const assistantMessage = createAssistantStreamMessage();
    setAgentMessages((messages) => [...messages, userMessage, assistantMessage]);
    setAgentInput("");
    setAgentStreaming(true);

    try {
      for await (const chunk of streamAssistantResponse({
        provider: normalizedProvider,
        userContent,
        workspaceName: workspaceSnapshot?.workspace.displayName,
        activeFilePath: editorDocument?.filePath,
      })) {
        setAgentMessages((messages) =>
          messages.map((message) =>
            message.id === assistantMessage.id
              ? {
                  ...message,
                  content: message.content + chunk.content,
                  streamStatus: chunk.done ? "complete" : "streaming",
                }
              : message,
          ),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAgentError(message);
      setAgentMessages((messages) =>
        messages.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, streamStatus: "failed", content: message }
            : item,
        ),
      );
    } finally {
      setAgentStreaming(false);
    }
  }

  async function runAgentTool(
    toolName: "read_file" | "list_files" | "search_files",
  ) {
    if (!workspaceSnapshot) {
      setAgentError("Open a Workspace before running tools.");
      return;
    }
    setAgentError(null);
    try {
      const workspaceRoot = workspaceSnapshot.workspace.rootPath;
      const result =
        toolName === "read_file"
          ? await executeReadFileTool(
              workspaceRoot,
              editorDocument?.filePath ?? "",
            )
          : toolName === "list_files"
            ? await executeListFilesTool(workspaceRoot)
            : await executeSearchFilesTool(workspaceRoot, searchQuery);

      setToolExecutions((executions) => [result.execution, ...executions]);
      setAgentMessages((messages) => [...messages, result.message]);
    } catch (error) {
      const failedExecution = {
        ...createPendingToolExecution(toolName),
        status: "failed" as const,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
      setToolExecutions((executions) => [failedExecution, ...executions]);
      setAgentError(failedExecution.errorMessage ?? "Tool failed.");
    }
  }

  return (
    <main className="app-shell">
      <aside className="panel">
        <h1>Binder Mini</h1>
        <button className="primary-action" type="button" onClick={handleOpenWorkspace}>
          Open Workspace
        </button>
        {workspaceSnapshot ? (
          <div className="workspace-summary">
            <strong>{workspaceSnapshot.workspace.displayName}</strong>
            <span>{workspaceSnapshot.workspace.rootPath}</span>
          </div>
        ) : (
          <p className="muted">No workspace open</p>
        )}
        {workspaceError ? <p className="error-text">{workspaceError}</p> : null}
        <ul className="file-list">
          {workspaceSnapshot?.entries.map((entry) => (
            <li key={entry.relativePath}>
              <span aria-hidden="true">{entry.kind === "directory" ? "dir" : "file"}</span>
              {entry.kind === "file" ? (
                <button
                  className="file-button"
                  type="button"
                  onClick={() => void handleOpenFile(entry.relativePath)}
                >
                  {entry.name}
                </button>
              ) : (
                <span>{entry.name}</span>
              )}
            </li>
          ))}
        </ul>
      </aside>
      <section className="editor-surface">
        <div className="editor-toolbar">
          <div>
            <strong>{editorDocument?.filePath ?? "Editor"}</strong>
            {editorDocument ? <span>{editorDocument.mode}</span> : null}
          </div>
          <button
            className="primary-action"
            type="button"
            disabled={!editorDocument || !canSaveEditorDocument(editorDocument)}
            onClick={() => void handleSaveFile()}
          >
            Save
          </button>
        </div>
        {editorError ? <p className="error-text">{editorError}</p> : null}
        {editorDocument ? (
          <textarea
            className="editor-textarea"
            readOnly={editorDocument.mode === "readonly"}
            value={editorDocument.content}
            onChange={(event) =>
              setEditorDocument({
                ...editorDocument,
                content: event.target.value,
                dirty: true,
              })
            }
          />
        ) : (
          <p className="muted">Open a file from the Workspace.</p>
        )}
      </section>
      <aside className="panel">
        <h2>Agent</h2>
        <label className="field">
          <span>Provider</span>
          <select
            value={providerConfig.provider}
            onChange={(event) =>
              setProviderConfig({
                ...providerConfig,
                provider: event.target.value as ProviderConfig["provider"],
              })
            }
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </label>
        <label className="field">
          <span>Model</span>
          <input
            value={providerConfig.model}
            onChange={(event) =>
              setProviderConfig({ ...providerConfig, model: event.target.value })
            }
            placeholder="model name"
          />
        </label>
        <label className="checkbox-field">
          <input
            checked={providerConfig.apiKeyConfigured}
            type="checkbox"
            onChange={(event) =>
              setProviderConfig({
                ...providerConfig,
                apiKeyConfigured: event.target.checked,
              })
            }
          />
          <span>API key configured</span>
        </label>
        <div className="agent-messages">
          {agentMessages.map((message) => (
            <div className="message-row" key={message.id}>
              <strong>
                {message.role}
                {message.streamStatus ? ` · ${message.streamStatus}` : ""}
              </strong>
              <p>{message.content}</p>
            </div>
          ))}
        </div>
        <textarea
          className="agent-input"
          value={agentInput}
          onChange={(event) => setAgentInput(event.target.value)}
          placeholder="Ask Agent to inspect the workspace"
        />
        {agentError ? <p className="error-text">{agentError}</p> : null}
        <button
          className="primary-action"
          type="button"
          disabled={agentStreaming}
          onClick={() => void handleSendAgentMessage()}
        >
          {agentStreaming ? "Streaming" : "Send"}
        </button>
        <div className="tool-actions">
          <button
            type="button"
            onClick={() => void runAgentTool("read_file")}
            disabled={!editorDocument}
          >
            Read active file
          </button>
          <button type="button" onClick={() => void runAgentTool("list_files")}>
            List files
          </button>
        </div>
        <label className="field">
          <span>Search</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="query"
          />
        </label>
        <button type="button" onClick={() => void runAgentTool("search_files")}>
          Search files
        </button>
        <div className="tool-list">
          {toolExecutions.map((execution) => (
            <div className="tool-row" key={execution.id}>
              <span>{execution.toolName}</span>
              <small>{execution.status}</small>
              {execution.resultSummary ? <p>{execution.resultSummary}</p> : null}
              {execution.errorMessage ? <p>{execution.errorMessage}</p> : null}
            </div>
          ))}
        </div>
        <small>{machines.length} state machines registered</small>
      </aside>
    </main>
  );
}
