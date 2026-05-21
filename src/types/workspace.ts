/**
 * @GOV
 * codes: BR-WS-STATE-001-DATA-WS-WS-OPEN-001,
 *        BR-WS-STATE-002-DATA-WS-WS-OPEN-001,
 *        BR-WS-PERSIST-001-DATA-WS-WS-OPEN-001,
 *        BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001,
 *        BR-WS-DATA-002-DATA-WS-WS-FILE-MANAGE-001
 * type: DATA
 * chain: WS-OPEN, WS-FILE-MANAGE
 * rules: BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-PERSIST-001, BR-WS-DATA-001, BR-WS-DATA-002
 * boundary: in=Workspace selection and file operation target | out=Workspace boundary, metadata, recent records, and recursive FileNode structure
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
