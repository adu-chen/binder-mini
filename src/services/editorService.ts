import { invoke } from "@tauri-apps/api/core";
import type { EditorDocument, EditorOpenRequest } from "../types/editor";

/**
 * @GOV
 * codes: BR-ED-STATE-001-GUARD-ED-ED-OPEN-FILE-005,
 *        BR-ED-PERSIST-001-RB-ED-ED-SAVE-FILE-003,
 *        BR-CORE-GOV-001-RB-ED-ED-SAVE-FILE-004
 * type: RB
 * chain: ED-OPEN-FILE, ED-SAVE-FILE
 * rules: BR-ED-STATE-001, BR-ED-PERSIST-001, BR-CORE-GOV-001
 * boundary: in=EditorDocument | out=save readiness decision | delegate=file type mode and dirty state checks
 */
export function canSaveEditorDocument(document: EditorDocument): boolean {
  return document.mode === "editable" && document.dirty;
}

/**
 * @GOV
 * codes: BR-ED-STATE-001-QUERY-ED-ED-OPEN-FILE-006,
 *        BR-ED-PERSIST-001-EFFECT-ED-ED-SAVE-FILE-006,
 *        BR-CORE-GOV-001-RB-ED-ED-OPEN-FILE-006
 * type: RB
 * chain: ED-OPEN-FILE, ED-SAVE-FILE
 * rules: BR-ED-STATE-001, BR-ED-PERSIST-001, BR-CORE-GOV-001
 * boundary: in=EditorOpenRequest or EditorSaveRequest | out=EditorDocument or persisted current file | delegate=Tauri read_workspace_file,write_workspace_file
 */
export async function openEditorDocument(
  request: EditorOpenRequest,
): Promise<EditorDocument> {
  return invoke<EditorDocument>("read_workspace_file", {
    workspaceRoot: request.workspaceRoot,
    relativePath: request.relativePath,
  });
}

export async function saveEditorDocument(
  document: EditorDocument,
): Promise<EditorDocument> {
  if (!canSaveEditorDocument(document)) {
    return document;
  }

  return invoke<EditorDocument>("write_workspace_file", {
    workspaceRoot: document.workspaceRoot,
    relativePath: document.filePath,
    content: document.content,
  });
}

export function getEditorModeForPath(filePath: string): EditorDocument["mode"] {
  const normalized = filePath.toLowerCase();
  return normalized.endsWith(".md") || normalized.endsWith(".txt")
    ? "editable"
    : "readonly";
}
