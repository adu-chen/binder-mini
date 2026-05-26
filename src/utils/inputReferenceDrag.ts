import type { InputReferenceDropPayload } from "../types/agent";

/**
 * @GOV
 * codes: BR-AG-DATA-001, BR-AG-UI-001
 * type: DATA
 * chain: AG-SEND-MESSAGE
 * rules: BR-AG-DATA-001, BR-AG-UI-001
 * boundary: in=Workspace file, EditorTab, editor selection, text, or URL drag payload | out=single structured InputReferenceDropPayload MIME contract consumed by ChatPanel DropZone; also exposes module-level pending-payload store (setPendingDragPayload / consumePendingDragPayload / clearPendingDragPayload) as WKWebView bypass channel when dataTransfer custom MIME types are unreadable in drop handlers
 * term_ref: TERM-AG-002
 */
export const INPUT_REFERENCE_MIME = "application/x-binder-input-reference";
export const LEGACY_FILE_PATH_MIME = "application/x-binder-file-path";
export const LEGACY_REFERENCE_PATH_MIME = "application/x-binder-reference-path";

// ── WKWebView drag-payload bypass ──────────────────────────────────────────
// dataTransfer.getData() returns "" for custom MIME types in WKWebView drop
// handlers (Tauri macOS). This module-level store passes the payload directly
// from dragstart to the drop handler without touching dataTransfer at all.
//
// Protocol:
//   dragstart  → setPendingDragPayload(payload)
//   drop       → consumePendingDragPayload()   (reads and clears atomically)
//   dragend    → clearPendingDragPayload()      (cleanup on cancelled drag)

let _pendingDragPayload: InputReferenceDropPayload | null = null;

export function setPendingDragPayload(payload: InputReferenceDropPayload): void {
  _pendingDragPayload = payload;
}

export function consumePendingDragPayload(): InputReferenceDropPayload | null {
  const payload = _pendingDragPayload;
  _pendingDragPayload = null;
  return payload;
}

export function clearPendingDragPayload(): void {
  _pendingDragPayload = null;
}

export function writeInputReferenceDragPayload(
  dataTransfer: DataTransfer,
  payload: InputReferenceDropPayload,
) {
  const encoded = JSON.stringify(payload);
  dataTransfer.clearData();
  dataTransfer.setData(INPUT_REFERENCE_MIME, encoded);
  if (payload.kind === "file") {
    dataTransfer.setData(LEGACY_FILE_PATH_MIME, payload.filePath);
    dataTransfer.setData(LEGACY_REFERENCE_PATH_MIME, payload.filePath);
    dataTransfer.setData("text/plain", payload.filePath);
  } else if (payload.kind === "selection") {
    // text/plain carries the selected content (not the file path) so that the
    // dataTransfer cascade in non-WKWebView environments produces a text
    // reference rather than a misidentified file reference.
    dataTransfer.setData(LEGACY_FILE_PATH_MIME, payload.filePath);
    dataTransfer.setData(LEGACY_REFERENCE_PATH_MIME, payload.filePath);
    dataTransfer.setData("text/plain", payload.content);
  } else if (payload.kind === "url") {
    dataTransfer.setData("text/plain", payload.url);
  } else {
    dataTransfer.setData("text/plain", payload.content);
  }
  dataTransfer.effectAllowed = "copy";
}

export function readInputReferenceDragPayload(
  dataTransfer: DataTransfer,
): InputReferenceDropPayload | null {
  const structured = dataTransfer.getData(INPUT_REFERENCE_MIME);
  if (structured) {
    try {
      return JSON.parse(structured) as InputReferenceDropPayload;
    } catch {
      return null;
    }
  }

  const legacyPath =
    dataTransfer.getData(LEGACY_FILE_PATH_MIME) ||
    dataTransfer.getData(LEGACY_REFERENCE_PATH_MIME);
  if (legacyPath.trim()) {
    return { kind: "file", filePath: legacyPath.trim() };
  }

  const plainText = dataTransfer.getData("text/plain").trim();
  if (!plainText) return null;
  if (/^https?:\/\/\S+$/i.test(plainText)) {
    return { kind: "url", url: plainText };
  }
  if (/^[^/\s]+(?:\/[^/\s]+)*\.[A-Za-z0-9]+$/.test(plainText)) {
    return { kind: "file", filePath: plainText };
  }
  return { kind: "text", content: plainText };
}
