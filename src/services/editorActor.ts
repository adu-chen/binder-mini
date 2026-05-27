import { useEffect, useRef, useState } from "react";
import { useActorRef, useSelector } from "@xstate/react";
import { editorMachine } from "../machines/editorMachine";
import { openEditorDocument } from "./editorService";
import { writeWorkspaceFile } from "../ipc";
import { getActiveEditor } from "../stores/editorRegistry";
import type { MarkdownStorage } from "tiptap-markdown";

// ── applyDiffReplaceInEditor ─────────────────────────────────────────────────

/**
 * @GOV
 * codes: BR-AG-DATA-003
 * type: UTIL
 * chain: AG-TOOL-CALL
 * rules: BR-AG-DATA-003
 * boundary: in=originalText string and newText string from ToolCall input_json |
 *           out=ApplyDiffResult with appliedRange {from, to} on success, or reason "no-editor"|"text-not-found" on failure |
 *           delegate=getActiveEditor registry singleton; TipTap editor.chain for ProseMirror mutation
 * term_ref: TERM-ED-003, TERM-DE-007, TERM-DE-008, TERM-AG-002
 */

export type ApplyDiffResult =
  | {
      success: true;
      appliedRange: { from: number; to: number };
      contentRevisionBeforeApply: string;
      contentRevisionAfterApply: string;
    }
  | { success: false; reason: "no-editor" | "text-not-found" };

export type RollbackDiffResult =
  | {
      success: true;
      appliedRange: { from: number; to: number };
      contentRevisionBeforeApply: string;
      contentRevisionAfterApply: string;
    }
  | { success: false; reason: "no-editor" | "text-not-found" | "revision-mismatch" };

export interface ApplyDiffOptions {
  /** 0-based index of which occurrence to replace when originalText appears multiple times. Default: 0. */
  occurrenceIndex?: number;
  /** Block-id from document_structure to narrow the search scope. When provided, only occurrences
   *  within that block are considered (occurrenceIndex counts within the block). */
  startBlockId?: string;
}

/** Generates a pseudo-unique 64-char hex revision token (Phase 6-B placeholder). */
function makeRevisionToken(): string {
  const ts = Date.now().toString(16).padStart(16, "0");
  const r1 = Math.random().toString(16).slice(2).padStart(24, "0");
  const r2 = Math.random().toString(16).slice(2).padStart(24, "0");
  return (ts + r1 + r2).slice(0, 64);
}

function serializeEditorContent(
  editor: NonNullable<ReturnType<typeof getActiveEditor>>,
  fileType: "md" | "txt" | "other" | undefined,
): string {
  if (fileType === "txt") {
    return editor.getText({ blockSeparator: "\n" });
  }
  const markdown = (editor.storage as { markdown?: MarkdownStorage }).markdown;
  if (markdown?.getMarkdown) {
    return markdown.getMarkdown();
  }
  return editor.getText({ blockSeparator: "\n" });
}

function readEditorRangeText(from: number, to: number): string | null {
  const editor = getActiveEditor();
  if (!editor || editor.isDestroyed) return null;
  const doc = editor.view.state.doc;
  if (from < 0 || from > to || to > doc.content.size + 1) return null;
  return doc.textBetween(from, to, "\n");
}

/**
 * BR-AG-DATA-003: Find originalText in the active TipTap ProseMirror document and
 * replace it with newText using deleteRange + insertContentAt.
 *
 * originalText must be plain text (no Markdown syntax characters).
 * Matching is performed on ProseMirror text node content, which is plain text.
 *
 * Options:
 *   occurrenceIndex — which occurrence to replace when originalText appears multiple times (0-based, default 0)
 *   startBlockId    — narrow search to the block with this id (occurrenceIndex counts within the block)
 *
 * Returns { success: false, reason: "text-not-found" } if the target is not found (no fallback).
 * Never throws; caller is responsible for dispatching LOGICAL_STATE_APPLIED_FAILED.
 */
export function applyDiffReplaceInEditor(
  originalText: string,
  newText: string,
  options: ApplyDiffOptions = {},
): ApplyDiffResult {
  // Guard: empty originalText would match at index 0 on any document, producing NaN positions.
  if (!originalText) {
    return { success: false, reason: "text-not-found" };
  }

  const editor = getActiveEditor();
  if (!editor || editor.isDestroyed) {
    return { success: false, reason: "no-editor" };
  }

  const { occurrenceIndex = 0, startBlockId } = options;
  const doc = editor.view.state.doc;

  // Build a flat text buffer with per-character PM-position mapping.
  // When startBlockId is provided, only collect text from that block's subtree.
  // doc.descendants visits text nodes in document order; `pos` is the
  // absolute PM position of the node's first character.
  let flatText = "";
  const charPositions: number[] = [];
  let inTargetBlock = false;

  doc.descendants((node, pos) => {
    // Block-scoped search: detect entry into/exit from the target block.
    if (startBlockId) {
      const blockId = (node.attrs as Record<string, unknown>)?.["data-block-id"] as string | undefined;
      if (blockId === startBlockId) {
        inTargetBlock = true;
      } else if (inTargetBlock && node.isBlock && blockId && blockId !== startBlockId) {
        // Entered a sibling block — stop collecting (return false to stop descent).
        return false;
      }
      if (!inTargetBlock) return;
    }

    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        charPositions.push(pos + i);
        flatText += node.text[i];
      }
    }
  });

  // Find the requested occurrence (occurrenceIndex-th match).
  let matchIdx = -1;
  let searchFrom = 0;
  for (let occurrence = 0; occurrence <= occurrenceIndex; occurrence++) {
    const found = flatText.indexOf(originalText, searchFrom);
    if (found === -1) {
      return { success: false, reason: "text-not-found" };
    }
    matchIdx = found;
    searchFrom = found + 1;
  }

  if (matchIdx === -1) {
    return { success: false, reason: "text-not-found" };
  }

  const from = charPositions[matchIdx];
  const to = charPositions[matchIdx + originalText.length - 1] + 1;
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return { success: false, reason: "text-not-found" };
  }

  const contentRevisionBeforeApply = makeRevisionToken();

  // BR-AG-DATA-003: deleteRange + insertContentAt is the sole mutation path.
  const applied = editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, newText).run();
  if (!applied) {
    return { success: false, reason: "text-not-found" };
  }

  const contentRevisionAfterApply = makeRevisionToken();

  return {
    success: true,
    appliedRange: { from, to: from + newText.length },
    contentRevisionBeforeApply,
    contentRevisionAfterApply,
  };
}

/**
 * BR-DE-STATE-002: Roll back a preapplied diff using its verified PM appliedRange.
 * The range must still contain expectedNewText; otherwise the diff is stale and
 * reject enters error instead of replacing the wrong occurrence.
 */
export function rollbackDiffInEditor(
  appliedRange: { from: number; to: number } | undefined,
  expectedNewText: string,
  originalText: string,
): RollbackDiffResult {
  const editor = getActiveEditor();
  if (!editor || editor.isDestroyed) {
    return { success: false, reason: "no-editor" };
  }
  if (!appliedRange) {
    return { success: false, reason: "text-not-found" };
  }

  const { from, to } = appliedRange;
  const currentText = readEditorRangeText(from, to);
  if (currentText === null) {
    return { success: false, reason: "text-not-found" };
  }
  if (currentText !== expectedNewText) {
    return { success: false, reason: "revision-mismatch" };
  }

  const contentRevisionBeforeApply = makeRevisionToken();
  const applied = editor
    .chain()
    .focus()
    .deleteRange({ from, to })
    .insertContentAt(from, originalText)
    .run();
  if (!applied) {
    return { success: false, reason: "text-not-found" };
  }
  const contentRevisionAfterApply = makeRevisionToken();

  return {
    success: true,
    appliedRange: { from, to: from + originalText.length },
    contentRevisionBeforeApply,
    contentRevisionAfterApply,
  };
}

export function isActiveEditorRangeText(
  appliedRange: { from: number; to: number } | undefined,
  expectedText: string,
): boolean {
  if (!appliedRange) return false;
  return readEditorRangeText(appliedRange.from, appliedRange.to) === expectedText;
}

/**
 * @GOV
 * codes: BR-ED-STATE-001, BR-ED-STATE-002, BR-ED-STATE-003, BR-ED-STATE-004, BR-ED-PERSIST-001, BR-ED-PERSIST-002, BR-ED-PERSIST-003, BR-ED-DATA-002
 * type: RB
 * chain: ED-OPEN-FILE, ED-SAVE-FILE
 * rules: BR-ED-STATE-001, BR-ED-STATE-002, BR-ED-STATE-003, BR-ED-STATE-004, BR-ED-PERSIST-001, BR-ED-PERSIST-002, BR-ED-PERSIST-003, BR-ED-DATA-002
 * boundary: in=workspaceRoot string, EditorOpenRequest filePath, and LogicalState string from EditorArea onChange | out=editorMachine actor with contentMapRef (LogicalState) and diskStateMapRef (DiskState) per tab | delegate=editorMachine guards and actions for tab lifecycle, openEditorDocument and writeWorkspaceFile for Tauri IPC
 * term_ref: TERM-ED-001, TERM-ED-003, TERM-DOC-001, TERM-DOC-002, TERM-DOC-003
 */
export function useEditorActor() {
  const edActor = useActorRef(editorMachine);

  // LogicalState per tabId (serialized markdown or plain text)
  const contentMapRef = useRef(new Map<string, string>());
  // DiskState per tabId (last confirmed-saved content)
  const diskStateMapRef = useRef(new Map<string, string>());
  const workspaceRootRef = useRef<string | null>(null);

  const edValue = useSelector(edActor, (s) => s.value as string);
  const edContext = useSelector(edActor, (s) => s.context);
  const edActiveTabId = edContext.activeTabId;
  const edTabs = edContext.tabs;
  const edErrorMessage = edContext.errorMessage;

  const [activeContent, setActiveContent] = useState("");

  useEffect(() => {
    setActiveContent(contentMapRef.current.get(edActiveTabId ?? "") ?? "");
  }, [edActiveTabId]);

  function onWorkspaceOpened(workspaceRoot: string) {
    workspaceRootRef.current = workspaceRoot;
    edActor.send({ type: "WORKSPACE_OPENED", workspaceRoot });
  }

  function onWorkspaceClosed() {
    workspaceRootRef.current = null;
    contentMapRef.current.clear();
    diskStateMapRef.current.clear();
    edActor.send({ type: "WORKSPACE_CLOSED" });
  }

  async function openFile(workspaceRoot: string, filePath: string) {
    const snap = edActor.getSnapshot();
    if (snap.context.tabs.some((t) => t.filePath === filePath)) {
      edActor.send({ type: "SWITCH_TAB", filePath });
      return;
    }
    workspaceRootRef.current = workspaceRoot;
    edActor.send({ type: "OPEN_FILE", filePath });
    try {
      const doc = await openEditorDocument({ workspaceRoot, relativePath: filePath });
      const fileType: "md" | "txt" | "other" = filePath.toLowerCase().endsWith(".md")
        ? "md"
        : filePath.toLowerCase().endsWith(".txt")
          ? "txt"
          : "other";
      contentMapRef.current.set(filePath, doc.content);
      diskStateMapRef.current.set(filePath, doc.content);
      edActor.send({ type: "FILE_LOADED", filePath, fileType, content: doc.content });
      // BR-ED-STATE-006: useEffect([edActiveTabId]) fires before async load completes
      // (during OPEN_FILE processing, content is still ""), so we must explicitly sync
      // activeContent here after the load finishes, when this file is still the active tab.
      if (edActor.getSnapshot().context.activeTabId === filePath) {
        setActiveContent(doc.content);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      edActor.send({ type: "LOAD_FAILED", filePath, errorMessage });
    }
  }

  async function saveFile(tabId?: string) {
    const workspaceRoot = workspaceRootRef.current;
    if (!workspaceRoot) return;
    const snap = edActor.getSnapshot();
    const targetTabId = tabId ?? snap.context.activeTabId;
    if (!targetTabId) return;
    const content = contentMapRef.current.get(targetTabId);
    if (content === undefined) return;
    const tab = snap.context.tabs.find((t) => t.id === targetTabId);
    if (!tab || tab.fileType === "other") return;
    edActor.send({ type: "SAVE" });
    try {
      await writeWorkspaceFile(workspaceRoot, tab.filePath, content);
      diskStateMapRef.current.set(targetTabId, content);
      edActor.send({ type: "SAVE_SUCCEEDED" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      edActor.send({ type: "SAVE_FAILED", errorMessage });
    }
  }

  function setContent(content: string) {
    const activeTabId = edActor.getSnapshot().context.activeTabId;
    if (!activeTabId) return;
    contentMapRef.current.set(activeTabId, content);
    setActiveContent(content);
    edActor.send({ type: "USER_EDIT" });
  }

  function applyDiffReplaceInTab(
    tabId: string,
    originalText: string,
    newText: string,
    options: ApplyDiffOptions = {},
  ): ApplyDiffResult {
    if (!originalText) {
      return { success: false, reason: "text-not-found" };
    }

    const activeTabId = edActor.getSnapshot().context.activeTabId;
    if (tabId === activeTabId) {
      const result = applyDiffReplaceInEditor(originalText, newText, options);
      if (result.success) {
        const tab = edActor.getSnapshot().context.tabs.find((t) => t.id === tabId);
        const editor = getActiveEditor();
        if (editor && !editor.isDestroyed) {
          const next = serializeEditorContent(editor, tab?.fileType);
          contentMapRef.current.set(tabId, next);
          setActiveContent(next);
        }
      }
      return result;
    }

    const content = contentMapRef.current.get(tabId);
    if (content === undefined) return { success: false, reason: "text-not-found" };

    const matchIdx = content.indexOf(originalText);
    if (matchIdx === -1) return { success: false, reason: "text-not-found" };

    const next = `${content.slice(0, matchIdx)}${newText}${content.slice(matchIdx + originalText.length)}`;
    contentMapRef.current.set(tabId, next);
    edActor.send({ type: "USER_EDIT" });

    return {
      success: true,
      appliedRange: { from: matchIdx, to: matchIdx + newText.length },
      contentRevisionBeforeApply: makeRevisionToken(),
      contentRevisionAfterApply: makeRevisionToken(),
    };
  }

  function rollbackDiffInTab(
    tabId: string,
    appliedRange: { from: number; to: number } | undefined,
    expectedNewText: string,
    originalText: string,
  ): RollbackDiffResult {
    const activeTabId = edActor.getSnapshot().context.activeTabId;
    if (tabId === activeTabId) {
      const result = rollbackDiffInEditor(appliedRange, expectedNewText, originalText);
      if (result.success) {
        const tab = edActor.getSnapshot().context.tabs.find((t) => t.id === tabId);
        const editor = getActiveEditor();
        if (editor && !editor.isDestroyed) {
          const next = serializeEditorContent(editor, tab?.fileType);
          contentMapRef.current.set(tabId, next);
          setActiveContent(next);
        }
      }
      return result;
    }

    const content = contentMapRef.current.get(tabId);
    if (content === undefined) return { success: false, reason: "text-not-found" };
    const matchIdx = content.indexOf(expectedNewText);
    if (matchIdx === -1) return { success: false, reason: "text-not-found" };
    if (content.indexOf(expectedNewText, matchIdx + 1) !== -1) {
      return { success: false, reason: "revision-mismatch" };
    }

    const next = `${content.slice(0, matchIdx)}${originalText}${content.slice(matchIdx + expectedNewText.length)}`;
    contentMapRef.current.set(tabId, next);
    edActor.send({ type: "USER_EDIT" });

    return {
      success: true,
      appliedRange: { from: matchIdx, to: matchIdx + originalText.length },
      contentRevisionBeforeApply: makeRevisionToken(),
      contentRevisionAfterApply: makeRevisionToken(),
    };
  }

  function closeTab(filePath: string) {
    edActor.send({ type: "CLOSE_TAB", filePath });
  }

  function switchTab(filePath: string) {
    edActor.send({ type: "SWITCH_TAB", filePath });
  }

  /**
   * BR-AG-DATA-004: Synchronously read the active file's LogicalState from contentMapRef,
   * bypassing React state lag. Use this at send time to guarantee the snapshot is the
   * canonical current logical state, not a stale React render's copy.
   */
  function getActiveContentNow(): string {
    return contentMapRef.current.get(edActiveTabId ?? "") ?? "";
  }

  return {
    edActor,
    edValue,
    edTabs,
    edActiveTabId,
    edErrorMessage,
    activeContent,
    getActiveContentNow,
    onWorkspaceOpened,
    onWorkspaceClosed,
    openFile,
    saveFile,
    setContent,
    applyDiffReplaceInTab,
    rollbackDiffInTab,
    closeTab,
    switchTab,
    applyDiffReplaceInEditor,
    isActiveEditorRangeText,
  };
}
