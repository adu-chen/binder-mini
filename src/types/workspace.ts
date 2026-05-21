/**
 * @GOV
 * codes: BR-WS-STATE-001-DATA-WS-WS-OPEN-001,
 *        BR-WS-DATA-001-DATA-WS-WS-FILE-MANAGE-001
 * type: DATA
 * chain: WS-OPEN, WS-FILE-MANAGE
 * rules: BR-WS-STATE-001, BR-WS-DATA-001
 * boundary: in=Workspace selection and file operation target | out=Workspace boundary and relative file target structure
 * term_ref: TERM-CORE-001
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
}

export interface WorkspaceSnapshot {
  workspace: Workspace;
  entries: WorkspaceEntry[];
}

export interface WorkspaceOpenResult {
  cancelled: boolean;
  snapshot?: WorkspaceSnapshot;
}
