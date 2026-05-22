/**
 * @GOV
 * codes: BR-WS-STATE-001-DATA-WS-WS-OPEN-001,
 *        BR-WS-STATE-002-DATA-WS-WS-OPEN-001,
 *        BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001,
 *        BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001,
 *        BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001,
 *        BR-WS-DATA-003-DATA-WS-WS-FILE-MANAGE-001,
 *        BR-WS-DATA-004-DATA-WS-WS-FILE-MANAGE-001,
 *        BR-WS-DATA-005-DATA-WS-WS-SEARCH-001
 * type: DATA
 * chain: WS-OPEN, WS-FILE-MANAGE, WS-SEARCH
 * rules: BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-PERSIST-001, BR-WS-DATA-001, BR-WS-DATA-002, BR-WS-DATA-003, BR-WS-DATA-004, BR-WS-DATA-005
 * boundary: in=Workspace selection, file operation target, and search request | out=Workspace boundary, metadata, recent records, recursive FileNode structure, PathConflict results, and scoped search results
 * term_ref: TERM-WS-001
 */
export interface Workspace {
  rootPath: string;
  displayName: string;
  status: "noWorkspace" | "opening" | "active" | "refreshing" | "error";
}

export interface WorkspaceFileTarget {
  workspaceRoot: string;
  relativePath: string;
}

export interface WorkspaceEntry {
  name: string;
  relativePath: string;
  kind: "file" | "directory";
  children?: WorkspaceEntry[];
}

export interface WorkspaceMetadata {
  workspaceDatabasePath: string;
  workspaceDatabaseInitialized: boolean;
}

export interface RecentWorkspace {
  rootPath: string;
  displayName: string;
  lastOpenedAt: number;
}

export interface PathConflict {
  code: "PATH_CONFLICT";
  targetPath: string;
  existingKind: "file" | "directory" | "other";
  message: string;
}

export interface WorkspaceMutationResult {
  success: boolean;
  entries: WorkspaceEntry[];
  conflict?: PathConflict;
}

export interface WorkspaceMoveRequest {
  sourcePath: string;
  targetPath: string;
}

export interface WorkspaceRenameRequest {
  sourcePath: string;
  newName: string;
}

export interface WorkspaceSnapshot {
  workspace: Workspace;
  entries: WorkspaceEntry[];
  metadata: WorkspaceMetadata;
}

export interface WorkspaceOpenResult {
  cancelled: boolean;
  snapshot?: WorkspaceSnapshot;
  recentWorkspaces?: RecentWorkspace[];
}
