import type { EditorDocument } from "../types/editor";

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
