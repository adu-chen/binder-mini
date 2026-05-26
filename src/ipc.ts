import { invoke } from "@tauri-apps/api/core";

/**
 * @GOV
 * codes: BR-WS-STATE-001, BR-WS-DATA-001, BR-ED-STATE-001, BR-ED-PERSIST-001, BR-AG-SEC-001, BR-DE-PERSIST-001, BR-SYS-GOV-001, BR-CORE-GOV-001
 * type: DATA
 * chain: WS-OPEN, WS-CLOSE, WS-FILE-MANAGE, WS-SEARCH, ED-OPEN-FILE, ED-SAVE-FILE, AG-SEND-MESSAGE, DE-CREATE-DIFF
 * rules: BR-WS-STATE-001, BR-WS-DATA-001, BR-ED-STATE-001, BR-ED-PERSIST-001, BR-AG-SEC-001, BR-DE-PERSIST-001, BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=Tauri IPC serialized responses from Rust backend commands | out=typed invoke wrappers consumed by service layer and state machine actors
 * term_ref: TERM-CORE-001, TERM-WS-001, TERM-ED-001, TERM-AG-002
 */

// Re-export IPC types that directly mirror Rust backend structs
export type { Workspace, WorkspaceEntry, WorkspaceMetadata, RecentWorkspace, WorkspaceSnapshot, WorkspaceOpenResult, WorkspaceMutationResult, PathConflict } from "./types/workspace";
export type { EditorDocument } from "./types/editor";
export type { SearchResult, ListFilesResult } from "./types/agent";

// Typed invoke wrappers — parameter names match Rust snake_case (converted to camelCase by Tauri)

export function healthCheck(): Promise<string> {
  return invoke<string>("health_check");
}

export function openWorkspace(): Promise<import("./types/workspace").WorkspaceOpenResult> {
  return invoke("open_workspace");
}

export function listRecentWorkspaces(): Promise<import("./types/workspace").RecentWorkspace[]> {
  return invoke("list_recent_workspaces");
}

export function readWorkspaceFile(workspaceRoot: string, relativePath: string): Promise<string> {
  return invoke<string>("read_workspace_file", { workspaceRoot, relativePath });
}

export function readFile(workspaceRoot: string, filePath: string): Promise<string> {
  return invoke<string>("read_file", { workspaceRoot, filePath });
}

export function listFiles(workspaceRoot: string, dirPath?: string): Promise<import("./types/agent").ListFilesResult> {
  return invoke("list_files", { workspaceRoot, dirPath: dirPath ?? null });
}

export function createWorkspaceFile(workspaceRoot: string, relativePath: string): Promise<import("./types/workspace").WorkspaceMutationResult> {
  return invoke("create_workspace_file", { workspaceRoot, relativePath });
}

export function createWorkspaceFolder(workspaceRoot: string, relativePath: string): Promise<import("./types/workspace").WorkspaceMutationResult> {
  return invoke("create_workspace_folder", { workspaceRoot, relativePath });
}

export function renameWorkspaceItem(workspaceRoot: string, relativePath: string, newName: string): Promise<import("./types/workspace").WorkspaceMutationResult> {
  return invoke("rename_workspace_item", { workspaceRoot, relativePath, newName });
}

export function moveWorkspaceItem(workspaceRoot: string, sourcePath: string, targetPath: string): Promise<import("./types/workspace").WorkspaceMutationResult> {
  return invoke("move_workspace_item", { workspaceRoot, sourcePath, targetPath });
}

export function deleteWorkspaceItem(workspaceRoot: string, relativePath: string): Promise<import("./types/workspace").WorkspaceMutationResult> {
  return invoke("delete_workspace_item", { workspaceRoot, relativePath });
}

export function searchFiles(workspaceRoot: string, query: string): Promise<import("./types/agent").SearchResult[]> {
  return invoke("search_files", { workspaceRoot, query });
}

export function writeWorkspaceFile(workspaceRoot: string, relativePath: string, content: string): Promise<import("./types/editor").EditorDocument> {
  return invoke("write_workspace_file", { workspaceRoot, relativePath, content });
}

// Phase 3+ stubs — command contracts declared before Rust implementation
export interface PendingDiffRecord {
  id: string;
  filePath: string;
  originalText: string;
  newText: string;
  summary: string;
  status: string;
  effectivePath: "open-file" | "closed-file";
  sourceToolId: string;
  baseRevision: string;
  appliedRangeFrom: number | null;
  appliedRangeTo: number | null;
  createdAt: number;
}

export interface ChatMessageRecord {
  id: string;
  /** BR-AG-DATA-002: includes "tool" for ToolResult messages that carry callId. */
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  streamStatus: string | null;
  toolCallId: string | null;
  createdAt: number;
  sessionId: string;
}

// ── Phase 3 persistence IPC stubs ─────────────────────────────────────────────

/**
 * @GOV
 * codes: BR-DE-PERSIST-002
 * type: DATA
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-PERSIST-002
 * boundary: in=PendingDiffRecord and workspace_root path | out=pending_diffs row upserted to WorkspaceDatabase via save_pending_diff Tauri command
 * term_ref: TERM-WS-002, TERM-DE-001, TERM-DE-005
 */
export function savePendingDiff(_workspaceRoot: string, _diff: PendingDiffRecord): Promise<void> {
  return invoke("save_pending_diff", { workspaceRoot: _workspaceRoot, diff: _diff });
}

/**
 * @GOV
 * codes: BR-DE-PERSIST-002
 * type: DATA
 * chain: DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-PERSIST-002
 * boundary: in=diff_id string and PendingDiffStatus string | out=pending_diffs.status updated in WorkspaceDatabase via update_diff_status Tauri command
 * term_ref: TERM-WS-002, TERM-DE-001
 */
export function updateDiffStatus(_workspaceRoot: string, _diffId: string, _status: string): Promise<void> {
  return invoke("update_diff_status", { workspaceRoot: _workspaceRoot, diffId: _diffId, status: _status });
}

/**
 * @GOV
 * codes: BR-DE-PERSIST-002, BR-WS-STATE-002
 * type: DATA
 * chain: WS-OPEN, DE-CREATE-DIFF
 * rules: BR-DE-PERSIST-002, BR-WS-STATE-002
 * boundary: in=workspace_root path | out=PendingDiffRecord list of non-terminal PendingDiff rows from WorkspaceDatabase via load_diffs_from_workspace Tauri command
 * term_ref: TERM-WS-002, TERM-DE-001, TERM-DE-005
 */
export function loadDiffsFromWorkspace(_workspaceRoot: string): Promise<PendingDiffRecord[]> {
  return invoke("load_diffs_from_workspace", { workspaceRoot: _workspaceRoot });
}

/**
 * @GOV
 * codes: BR-AG-PERSIST-001
 * type: DATA
 * chain: WS-CLOSE, AG-SEND-MESSAGE
 * rules: BR-AG-PERSIST-001
 * boundary: in=AgentMessage list and workspace_root path | out=chat_messages table replaced in WorkspaceDatabase via save_chat_messages Tauri command
 * term_ref: TERM-WS-002, TERM-AG-010, TERM-AG-013
 */
export function saveChatMessages(_workspaceRoot: string, _messages: ChatMessageRecord[]): Promise<void> {
  return invoke("save_chat_messages", { workspaceRoot: _workspaceRoot, messages: _messages });
}

/**
 * @GOV
 * codes: BR-AG-PERSIST-001
 * type: DATA
 * chain: WS-OPEN, AG-SEND-MESSAGE
 * rules: BR-AG-PERSIST-001
 * boundary: in=workspace_root path | out=ChatMessageRecord list ordered by created_at from WorkspaceDatabase chat_messages via load_chat_messages Tauri command
 * term_ref: TERM-WS-002, TERM-AG-010, TERM-AG-013
 */
export function loadChatMessages(_workspaceRoot: string): Promise<ChatMessageRecord[]> {
  return invoke("load_chat_messages", { workspaceRoot: _workspaceRoot });
}

/**
 * @GOV
 * codes: BR-AG-SEC-001, BR-AG-PERSIST-002
 * type: DATA
 * chain: AG-SEND-MESSAGE
 * rules: BR-AG-SEC-001, BR-AG-PERSIST-002
 * boundary: in=provider string and api_key string | out=ProviderCredential persisted to app_config_dir on Rust side only; raw key never returned to TypeScript layer
 * term_ref: TERM-AG-011, TERM-AG-013
 */
export function saveApiKey(provider: string, apiKey: string): Promise<void> {
  return invoke("save_api_key", { provider, apiKey });
}

/**
 * @GOV
 * codes: BR-AG-SEC-001, BR-AG-PERSIST-002
 * type: DATA
 * chain: AG-SEND-MESSAGE
 * rules: BR-AG-SEC-001, BR-AG-PERSIST-002
 * boundary: in=provider string | out=boolean apiKeyConfigured; raw key never leaves Rust backend
 * term_ref: TERM-AG-011, TERM-AG-013
 */
export function isApiKeyConfigured(provider: string): Promise<boolean> {
  return invoke("is_api_key_configured", { provider });
}
