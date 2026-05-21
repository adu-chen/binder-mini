/**
 * @GOV
 * codes: BR-ED-STATE-001-DATA-ED-ED-OPEN-FILE-001,
 *        BR-ED-PERSIST-001-DATA-ED-ED-SAVE-FILE-001
 * type: DATA
 * chain: ED-OPEN-FILE, ED-SAVE-FILE
 * rules: BR-ED-STATE-001, BR-ED-PERSIST-001
 * boundary: in=Workspace file target and loaded document content | out=Editor document state and save target
 */
export interface EditorDocument {
  filePath: string;
  workspaceRoot: string;
  content: string;
  mode: "editable" | "readonly";
  dirty: boolean;
}

export interface EditorOpenRequest {
  workspaceRoot: string;
  relativePath: string;
}

export interface EditorSaveRequest {
  workspaceRoot: string;
  relativePath: string;
  content: string;
}
