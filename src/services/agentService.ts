import { invoke } from "@tauri-apps/api/core";
import type {
  AgentMessage,
  InputReference,
  ListFilesResult,
  ProviderConfig,
  SearchResult,
  ToolExecutionResult,
  ToolName,
  ToolExecution,
} from "../types/agent";

/**
 * @GOV
 * codes: BR-AG-STATE-001-GUARD-AG-AG-SEND-MESSAGE-007,
 *        BR-AG-OBS-001-EFFECT-AG-AG-TOOL-CALL-008,
 *        BR-AG-DATA-001-GUARD-AG-AG-TOOL-CALL-009,
 *        BR-CORE-GOV-001-RB-AG-AG-TOOL-CALL-010
 * type: RB
 * chain: AG-SEND-MESSAGE, AG-TOOL-CALL
 * rules: BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001, BR-CORE-GOV-001
 * boundary: in=ProviderConfig, InputReference, and ToolExecution | out=Agent request readiness and readonly reference assertions | delegate=provider validation, ToolExecution recording, InputReference guard
 * term_ref: TERM-AG-002
 */
export function canSendAgentMessage(provider: ProviderConfig): boolean {
  return provider.apiKeyConfigured && provider.model.trim().length > 0;
}

export function normalizeProviderConfig(
  provider: ProviderConfig,
): ProviderConfig {
  return {
    provider: provider.provider,
    model: provider.model.trim(),
    apiKeyConfigured: provider.apiKeyConfigured,
  };
}

export function isReadonlyInputReference(reference: InputReference): boolean {
  return reference.mode === "readonly";
}

export function createPendingToolExecution(toolName: ToolName): ToolExecution {
  return {
    id: `tool-${Date.now()}`,
    toolName,
    inputBoundary: "Workspace",
    status: "pending",
  };
}

export function completeToolExecution(
  execution: ToolExecution,
  resultSummary: string,
): ToolExecution {
  return {
    ...execution,
    status: "succeeded",
    resultSummary,
  };
}

export function failToolExecution(
  execution: ToolExecution,
  errorMessage: string,
): ToolExecution {
  return {
    ...execution,
    status: "failed",
    errorMessage,
  };
}

export function createUserAgentMessage(content: string): AgentMessage {
  return {
    id: `msg-${Date.now()}`,
    role: "user",
    content: content.trim(),
  };
}

export function canRecordAgentMessage(content: string): boolean {
  return content.trim().length > 0;
}

export async function executeReadFileTool(
  workspaceRoot: string,
  filePath: string,
): Promise<ToolExecutionResult> {
  const execution = createPendingToolExecution("read_file");
  const content = await invoke<string>("read_file", {
    workspaceRoot,
    filePath,
  });
  const summary = summarizeText(content);
  return {
    execution: completeToolExecution(execution, summary),
    message: {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: summary,
    },
  };
}

export async function executeListFilesTool(
  workspaceRoot: string,
  dirPath = "",
): Promise<ToolExecutionResult> {
  const execution = createPendingToolExecution("list_files");
  const result = await invoke<ListFilesResult>("list_files", {
    workspaceRoot,
    dirPath,
  });
  const summary = `${result.entries.length} entries: ${result.entries
    .map((entry) => entry.relativePath)
    .join(", ")}`;
  return {
    execution: completeToolExecution(execution, summary),
    message: {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: summary,
    },
  };
}

export async function executeSearchFilesTool(
  workspaceRoot: string,
  query: string,
): Promise<ToolExecutionResult> {
  const execution = createPendingToolExecution("search_files");
  const results = await invoke<SearchResult[]>("search_files", {
    workspaceRoot,
    query,
  });
  const summary = summarizeSearchResults(results);
  return {
    execution: completeToolExecution(execution, summary),
    message: {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: summary,
    },
  };
}

export function summarizeText(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

export function summarizeSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "No matches";
  return results
    .map((result) => `${result.filePath}: ${result.preview}`)
    .join("\n");
}
