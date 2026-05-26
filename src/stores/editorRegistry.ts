import type { Editor } from "@tiptap/core";

/**
 * @GOV
 * codes: BR-AG-DATA-003-DATA-DE-DE-CREATE-DIFF-010,
 *        BR-ED-STATE-005-DATA-DE-ED-DIFF-RENDER-001,
 *        BR-ED-STATE-006-DATA-DE-ED-DIFF-RENDER-002
 * type: DATA
 * chain: DE-CREATE-DIFF, ED-DIFF-RENDER
 * rules: BR-AG-DATA-003, BR-ED-STATE-005, BR-ED-STATE-006
 * boundary: in=TipTap Editor instance registered by EditorArea on mount |
 *           out=active Editor reference consumed by applyDiffReplaceInEditor
 * term_ref: TERM-ED-003, TERM-DOC-002, TERM-DE-006, TERM-DE-007, TERM-DE-008
 */

// Module-level singleton reference to the currently-mounted TipTap editor.
// EditorArea registers the editor on mount and clears it on unmount.
// applyDiffReplaceInEditor reads from this registry.
let _activeEditor: Editor | null = null;

/**
 * Register the currently-mounted TipTap editor.
 * Called by EditorArea when the editor instance is available.
 */
export function registerEditor(editor: Editor): void {
  _activeEditor = editor;
}

/**
 * Clear the active editor reference.
 * Called by EditorArea on unmount or when the editor is destroyed.
 */
export function unregisterEditor(): void {
  _activeEditor = null;
}

/**
 * Get the currently-active TipTap editor, or null if no editor is mounted.
 * Used by applyDiffReplaceInEditor in the tool execution path.
 */
export function getActiveEditor(): Editor | null {
  return _activeEditor;
}

// ── document_structure extraction ──────────────────────────────────────────

const DOCUMENT_STRUCTURE_MAX_CHARS = 1500;

interface StructureNode {
  type: "heading" | "paragraph";
  level?: number; // only for headings
  blockId: string;
  textPreview: string; // first ~60 chars of plain text
}

/**
 * Extract the document structure from the active TipTap editor as XML.
 * Returns null when no editor is active or the file is not .md.
 *
 * Output format (AG-M-P-02 §3 ④):
 * <document_structure file="{filePath}">
 *   <heading level="1" block-id="uuid-001">Title text</heading>
 *   <paragraph block-id="uuid-002">First 60 chars...</paragraph>
 * </document_structure>
 */
export function extractDocumentStructure(filePath: string): string | null {
  if (!_activeEditor || _activeEditor.isDestroyed) return null;
  // Only meaningful for Markdown files.
  if (!filePath.toLowerCase().endsWith(".md")) return null;

  const doc = _activeEditor.view.state.doc;
  const nodes: StructureNode[] = [];

  doc.forEach((node) => {
    if (node.type.name !== "heading" && node.type.name !== "paragraph") return;

    const blockId =
      (node.attrs as Record<string, unknown>)?.["data-block-id"] as string | undefined;
    if (!blockId) return; // skip nodes without block-id (BlockIdExtension not yet run)

    // Collect plain text for this block node.
    let plainText = "";
    node.forEach((child) => {
      if (child.isText && child.text) plainText += child.text;
    });

    nodes.push({
      type: node.type.name as "heading" | "paragraph",
      level: node.type.name === "heading"
        ? ((node.attrs as Record<string, unknown>)?.level as number | undefined) ?? 1
        : undefined,
      blockId,
      textPreview: plainText.slice(0, 60),
    });
  });

  if (nodes.length === 0) return null;

  // Build XML, respecting the 1500-char budget.
  const xmlLines: string[] = [`<document_structure file="${escapeXmlAttr(filePath)}">`];
  let total = xmlLines[0].length;

  for (const n of nodes) {
    let line: string;
    if (n.type === "heading") {
      line = `  <heading level="${n.level}" block-id="${escapeXmlAttr(n.blockId)}">${escapeXmlText(n.textPreview)}</heading>`;
    } else {
      line = `  <paragraph block-id="${escapeXmlAttr(n.blockId)}">${escapeXmlText(n.textPreview)}</paragraph>`;
    }
    if (total + line.length + 20 > DOCUMENT_STRUCTURE_MAX_CHARS) break;
    xmlLines.push(line);
    total += line.length;
  }

  xmlLines.push("</document_structure>");
  return xmlLines.join("\n");
}

function escapeXmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeXmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
