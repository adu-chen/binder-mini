import type { WorkspaceFileTarget } from "./workspace";
import type { WorkspaceEntry } from "./workspace";

/**
 * @GOV
 * codes: BR-AG-STATE-001-DATA-AG-AG-SEND-MESSAGE-001,
 *        BR-AG-OBS-001-DATA-AG-AG-TOOL-CALL-001,
 *        BR-AG-DATA-001-DATA-AG-AG-TOOL-CALL-002,
 *        BR-AG-DATA-004-DATA-AG-AG-SEND-MESSAGE-002
 * type: DATA
 * chain: AG-SEND-MESSAGE, AG-TOOL-CALL
 * rules: BR-AG-STATE-001, BR-AG-OBS-001, BR-AG-DATA-001, BR-AG-DATA-004
 * boundary: in=Provider configuration, Workspace file target, user supplied references, and ActiveFile LogicalStateSnapshot | out=Agent message, ToolExecution, InputReference, and AgentRuntimeContext structures
 * term_ref: TERM-AG-001, TERM-AG-015
 */
export interface ProviderConfig {
  provider: "openai" | "anthropic" | "deepseek";
  model: string;
  apiKeyConfigured: boolean;
}

export interface ProviderCredential {
  provider: ProviderConfig["provider"];
  apiKey: string;
  updatedAt: number;
}

export interface AgentRuntimeContext {
  activeFilePath?: string;
  activeFileMode?: "editable" | "readonly";
  activeFileDirty?: boolean;
  pendingDiffCount?: number;
  activeFileLogicalStateSnapshot?: string;
  activeFileSnapshotTruncated?: boolean;
  /** XML string built by extractDocumentStructure(); injected as L0 ④ in system prompt. */
  documentStructure?: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  streamStatus?: "streaming" | "complete" | "failed";
}

export interface InputReference {
  id: string;
  target: WorkspaceFileTarget;
  mode: "readonly";
}

export type ToolName =
  | "read_file"
  | "list_files"
  | "search_files"
  | "edit_current_editor_document"
  | "create_file"
  | "create_folder"
  | "rename_file"
  | "move_file"
  | "delete_file"
  | "update_file";

export interface ToolExecution {
  id: string;
  toolName: ToolName;
  inputBoundary: string;
  status: "pending" | "running" | "succeeded" | "failed";
  resultSummary?: string;
  errorMessage?: string;
}

export interface SearchResult {
  filePath: string;
  preview: string;
}

export interface ToolExecutionResult {
  execution: ToolExecution;
  message: AgentMessage;
}

export interface ListFilesResult {
  entries: WorkspaceEntry[];
}

export interface AgentStreamRequest {
  provider: ProviderConfig;
  userContent: string;
  workspaceName?: string;
  activeFilePath?: string;
}

export interface AgentStreamChunk {
  content: string;
  done: boolean;
}
