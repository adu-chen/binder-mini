import { useEffect, useState } from "react";
import { createAgentMachineDefinition } from "./machines/agentMachine";
import { createDiffMachineDefinition } from "./machines/diffMachine";
import { createEditorMachineDefinition } from "./machines/editorMachine";
import { createWorkspaceMachineDefinition } from "./machines/workspaceMachine";
import {
  canRecordAgentMessage,
  canSendAgentMessage,
  completeToolExecution,
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
  acceptPendingDiff,
  createPendingDiffFromCurrentEditor,
  createTerminalDiffCard,
  rejectPendingDiff,
  shouldExpirePendingDiff,
} from "./services/diffService";
import {
  canSaveEditorDocument,
  openEditorDocument,
  saveEditorDocument,
} from "./services/editorService";
import type { AgentMessage, ProviderConfig, ToolExecution } from "./types/agent";
import type { PendingDiff, TerminalDiffCard } from "./types/diff";
import {
  createWorkspaceFile,
  createWorkspaceFolder,
  deleteWorkspaceItem,
  isPathConflict,
  listRecentWorkspaces,
  moveWorkspaceItem,
  normalizeRecentWorkspaces,
  openWorkspace,
  renameWorkspaceItem,
  sortWorkspaceEntries,
} from "./services/workspaceService";
import type { EditorDocument } from "./types/editor";
import type {
  RecentWorkspace,
  WorkspaceEntry,
  WorkspaceMutationResult,
  WorkspaceSnapshot,
} from "./types/workspace";

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
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [newWorkspaceItemPath, setNewWorkspaceItemPath] = useState("");
  const [structureSourcePath, setStructureSourcePath] = useState("");
  const [structureTargetPath, setStructureTargetPath] = useState("");
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
  const [pendingDiff, setPendingDiff] = useState<PendingDiff | null>(null);
  const [terminalDiffCards, setTerminalDiffCards] = useState<TerminalDiffCard[]>(
    [],
  );
  const machines = [
    createWorkspaceMachineDefinition(),
    createEditorMachineDefinition(),
    createAgentMachineDefinition(),
    createDiffMachineDefinition(),
  ];

  useEffect(() => {
    void listRecentWorkspaces()
      .then((workspaces) => setRecentWorkspaces(normalizeRecentWorkspaces(workspaces)))
      .catch((error) => setWorkspaceError(error instanceof Error ? error.message : String(error)));
  }, []);

  async function handleOpenWorkspace() {
    setWorkspaceError(null);
    try {
      const result = await openWorkspace();
      if (!result.cancelled && result.snapshot) {
        setWorkspaceSnapshot({
          ...result.snapshot,
          entries: sortWorkspaceEntries(result.snapshot.entries),
        });
        setRecentWorkspaces(normalizeRecentWorkspaces(result.recentWorkspaces ?? []));
        setEditorDocument(null);
        setPendingDiff(null);
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleCreateWorkspaceItem(kind: "file" | "folder") {
    if (!workspaceSnapshot) return;
    const relativePath = newWorkspaceItemPath.trim();
    if (!relativePath) return;
    setWorkspaceError(null);
    try {
      const result =
        kind === "file"
          ? await createWorkspaceFile(workspaceSnapshot.workspace.rootPath, relativePath)
          : await createWorkspaceFolder(workspaceSnapshot.workspace.rootPath, relativePath);
      if (isPathConflict(result)) {
        setWorkspaceError(result.conflict.message);
        return;
      }
      setWorkspaceSnapshot({
        ...workspaceSnapshot,
        entries: sortWorkspaceEntries(result.entries),
      });
      setNewWorkspaceItemPath("");
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    }
  }

  async function applyWorkspaceMutation(
    action: () => Promise<WorkspaceMutationResult>,
    clearInputs: () => void,
  ) {
    if (!workspaceSnapshot) return;
    setWorkspaceError(null);
    try {
      const result = await action();
      if (isPathConflict(result)) {
        setWorkspaceError(result.conflict.message);
        return;
      }
      setWorkspaceSnapshot({
        ...workspaceSnapshot,
        entries: sortWorkspaceEntries(result.entries),
      });
      clearInputs();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRenameWorkspaceItem() {
    if (!workspaceSnapshot) return;
    const sourcePath = structureSourcePath.trim();
    const newName = structureTargetPath.trim();
    if (!sourcePath || !newName) return;
    await applyWorkspaceMutation(
      () =>
        renameWorkspaceItem(workspaceSnapshot.workspace.rootPath, {
          sourcePath,
          newName,
        }),
      () => {
        setStructureSourcePath("");
        setStructureTargetPath("");
      },
    );
  }

  async function handleMoveWorkspaceItem() {
    if (!workspaceSnapshot) return;
    const sourcePath = structureSourcePath.trim();
    const targetPath = structureTargetPath.trim();
    if (!sourcePath || !targetPath) return;
    await applyWorkspaceMutation(
      () =>
        moveWorkspaceItem(workspaceSnapshot.workspace.rootPath, {
          sourcePath,
          targetPath,
        }),
      () => {
        setStructureSourcePath("");
        setStructureTargetPath("");
      },
    );
  }

  async function handleDeleteWorkspaceItem() {
    if (!workspaceSnapshot) return;
    const relativePath = structureSourcePath.trim();
    if (!relativePath) return;
    await applyWorkspaceMutation(
      () => deleteWorkspaceItem(workspaceSnapshot.workspace.rootPath, relativePath),
      () => {
        setStructureSourcePath("");
        setStructureTargetPath("");
      },
    );
  }

  async function handleOpenFile(relativePath: string) {
    if (!workspaceSnapshot) return;
    setEditorError(null);
    try {
      const openedDocument = await openEditorDocument({
          workspaceRoot: workspaceSnapshot.workspace.rootPath,
          relativePath,
        });
      setEditorDocument(openedDocument);
      if (pendingDiff && pendingDiff.filePath !== openedDocument.filePath) {
        expirePendingDiff(pendingDiff);
      }
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

  function expirePendingDiff(diff: PendingDiff) {
    setTerminalDiffCards((cards) => [
      createTerminalDiffCard(diff.id, "expired"),
      ...cards,
    ]);
    setPendingDiff(null);
  }

  function handleEditorChange(content: string) {
    if (!editorDocument) return;
    const nextDocument = {
      ...editorDocument,
      content,
      dirty: true,
    };
    setEditorDocument(nextDocument);
    if (
      pendingDiff &&
      shouldExpirePendingDiff(pendingDiff, nextDocument.filePath, content)
    ) {
      expirePendingDiff(pendingDiff);
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

  function handleCreatePendingDiff() {
    setAgentError(null);
    if (!editorDocument || editorDocument.mode !== "editable") {
      setAgentError("Open an editable current document before proposing an edit.");
      return;
    }
    if (!canRecordAgentMessage(agentInput)) {
      setAgentError("Edit instruction cannot be empty.");
      return;
    }
    const execution = createPendingToolExecution("edit_current_editor_document");
    try {
      const diff = createPendingDiffFromCurrentEditor({
        filePath: editorDocument.filePath,
        originalText: editorDocument.content,
        instruction: agentInput,
      });
      if (pendingDiff) {
        setTerminalDiffCards((cards) => [
          createTerminalDiffCard(pendingDiff.id, "expired"),
          ...cards,
        ]);
      }
      setPendingDiff(diff);
      setToolExecutions((executions) => [
        completeToolExecution(execution, `PendingDiff created for ${diff.filePath}`),
        ...executions,
      ]);
      setAgentMessages((messages) => [
        ...messages,
        createUserAgentMessage(agentInput),
        {
          id: `msg-${Date.now()}-diff`,
          role: "assistant",
          content: `Created PendingDiff for ${diff.filePath}. Review before writing.`,
          streamStatus: "complete",
        },
      ]);
      setAgentInput("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setToolExecutions((executions) => [
        {
          ...execution,
          status: "failed",
          errorMessage: message,
        },
        ...executions,
      ]);
      setAgentError(message);
    }
  }

  async function handleAcceptPendingDiff() {
    if (!pendingDiff || !editorDocument) return;
    try {
      const result = acceptPendingDiff(
        pendingDiff,
        editorDocument.filePath,
        editorDocument.content,
      );
      if (result.terminalCard.status === "expired") {
        setTerminalDiffCards((cards) => [result.terminalCard, ...cards]);
        setPendingDiff(null);
        return;
      }
      const savedDocument = await saveEditorDocument({
        ...editorDocument,
        content: result.content,
        dirty: true,
      });
      setEditorDocument(savedDocument);
      setTerminalDiffCards((cards) => [result.terminalCard, ...cards]);
      setPendingDiff(null);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleRejectPendingDiff() {
    if (!pendingDiff) return;
    setTerminalDiffCards((cards) => [rejectPendingDiff(pendingDiff), ...cards]);
    setPendingDiff(null);
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
        {recentWorkspaces.length ? (
          <section className="recent-workspaces" aria-label="Recent Workspaces">
            <strong>Recent</strong>
            <ul>
              {recentWorkspaces.map((workspace) => (
                <li key={workspace.rootPath}>
                  <span>{workspace.displayName}</span>
                  <small>{workspace.rootPath}</small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {workspaceError ? <p className="error-text">{workspaceError}</p> : null}
        {workspaceSnapshot ? (
          <div className="workspace-create">
            <input
              aria-label="New Workspace item path"
              placeholder="notes/new.md"
              value={newWorkspaceItemPath}
              onChange={(event) => setNewWorkspaceItemPath(event.target.value)}
            />
            <div>
              <button type="button" onClick={() => void handleCreateWorkspaceItem("file")}>
                File
              </button>
              <button type="button" onClick={() => void handleCreateWorkspaceItem("folder")}>
                Folder
              </button>
            </div>
          </div>
        ) : null}
        {workspaceSnapshot ? (
          <div className="workspace-structure">
            <input
              aria-label="Workspace structure source path"
              placeholder="source path"
              value={structureSourcePath}
              onChange={(event) => setStructureSourcePath(event.target.value)}
            />
            <input
              aria-label="Workspace structure target path or new name"
              placeholder="target path or new name"
              value={structureTargetPath}
              onChange={(event) => setStructureTargetPath(event.target.value)}
            />
            <div>
              <button type="button" onClick={() => void handleRenameWorkspaceItem()}>
                Rename
              </button>
              <button type="button" onClick={() => void handleMoveWorkspaceItem()}>
                Move
              </button>
              <button type="button" onClick={() => void handleDeleteWorkspaceItem()}>
                Delete
              </button>
            </div>
          </div>
        ) : null}
        {workspaceSnapshot ? (
          <WorkspaceEntryList entries={workspaceSnapshot.entries} onOpenFile={handleOpenFile} />
        ) : null}
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
            onChange={(event) => handleEditorChange(event.target.value)}
          />
        ) : (
          <p className="muted">Open a file from the Workspace.</p>
        )}
        {pendingDiff ? (
          <section className="diff-card">
            <header>
              <strong>PendingDiff</strong>
              <span>{pendingDiff.filePath}</span>
            </header>
            <p>{pendingDiff.summary}</p>
            <div className="diff-preview">
              <div>
                <strong>Original</strong>
                <pre>{pendingDiff.originalText}</pre>
              </div>
              <div>
                <strong>Proposed</strong>
                <pre>{pendingDiff.proposedText}</pre>
              </div>
            </div>
            <div className="diff-actions">
              <button
                className="primary-action"
                type="button"
                onClick={() => void handleAcceptPendingDiff()}
              >
                Accept
              </button>
              <button type="button" onClick={handleRejectPendingDiff}>
                Reject
              </button>
            </div>
          </section>
        ) : null}
        {terminalDiffCards.length > 0 ? (
          <div className="terminal-diff-list">
            {terminalDiffCards.map((card) => (
              <div className="terminal-diff-card" key={`${card.diffId}-${card.status}`}>
                <strong>{card.status}</strong>
                <span>{card.message}</span>
              </div>
            ))}
          </div>
        ) : null}
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
        <button
          type="button"
          onClick={handleCreatePendingDiff}
          disabled={!editorDocument || editorDocument.mode !== "editable"}
        >
          Propose edit
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

function WorkspaceEntryList({
  entries,
  onOpenFile,
}: {
  entries: WorkspaceEntry[];
  onOpenFile: (relativePath: string) => void | Promise<void>;
}) {
  return (
    <ul className="file-list">
      {entries.map((entry) => (
        <li key={entry.relativePath}>
          <div className="file-row">
            <span aria-hidden="true">{entry.kind === "directory" ? "dir" : "file"}</span>
            {entry.kind === "file" ? (
              <button
                className="file-button"
                type="button"
                onClick={() => void onOpenFile(entry.relativePath)}
              >
                {entry.name}
              </button>
            ) : (
              <span>{entry.name}</span>
            )}
          </div>
          {entry.children?.length ? (
            <WorkspaceEntryList entries={entry.children} onOpenFile={onOpenFile} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
