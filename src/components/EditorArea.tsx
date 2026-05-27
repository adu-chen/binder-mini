/**
 * @GOV
 * codes: BR-ED-STATE-006, BR-DE-UI-002
 * type: RB
 * chain: ED-OPEN-FILE, ED-SAVE-FILE, DE-ACCEPT-DIFF, DE-REJECT-DIFF
 * rules: BR-ED-STATE-006, BR-DE-UI-002
 * boundary: in=editorMachine state name and EditorTab content string | out=TipTap EditorContent with GreenAdditionDecoration for appliedRange only; never renders red deletion decoration
 * term_ref: TERM-ED-001, TERM-ED-003, TERM-DE-001
 */

import { useEffect, useRef } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import type { MarkdownStorage } from "tiptap-markdown";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { BlockIdExtension, blockIdPluginKey } from "./extensions/BlockIdExtension";
import { registerEditor, unregisterEditor } from "../stores/editorRegistry";

type EditorStateName =
  | "noWorkspace"
  | "idle"
  | "loading"
  | "editing"
  | "dirty"
  | "saving"
  | "readonly"
  | "error";

interface AppliedRange {
  from: number;
  to: number;
}

interface EditorAreaProps {
  stateName: EditorStateName;
  filePath?: string | null;
  content: string;
  fileType?: "md" | "txt" | "other";
  appliedRanges?: AppliedRange[];
  errorMessage: string | null;
  onChange: (content: string) => void;
}

/**
 * BR-DE-UI-002: GreenAdditionDecoration renders a --diff-add-bg inline highlight
 * over the appliedRanges of preapplied PendingDiffs.
 * Red deletion decoration is confined to DiffCard only — never injected here.
 * Updated via ProseMirror transaction meta when appliedRanges prop changes.
 */
const greenDecoKey = new PluginKey<DecorationSet>("greenAdditionDecoration");

const GreenAdditionDecoration = Extension.create({
  name: "greenAdditionDecoration",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: greenDecoKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, prevSet) {
            const meta = tr.getMeta(greenDecoKey) as
              | { from: number; to: number }[]
              | null
              | undefined;
            if (meta === undefined) {
              // No meta set — map existing decorations through document changes.
              return prevSet.map(tr.mapping, tr.doc);
            }
            if (!meta) return DecorationSet.empty;
            if (meta.length === 0) return DecorationSet.empty;
            const docSize = tr.doc.content.size;
            const decorations = meta
              .filter(({ from, to }) => from < to && from >= 0 && to <= docSize + 1)
              .map(({ from, to }) =>
                Decoration.inline(from, to, {
                  style: "background: var(--diff-add-bg);",
                }),
              );
            return decorations.length > 0
              ? DecorationSet.create(tr.doc, decorations)
              : DecorationSet.empty;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function getMarkdownContent(editor: { storage: unknown }): string {
  const md = (editor.storage as { markdown?: MarkdownStorage }).markdown;
  if (!md?.getMarkdown) throw new Error("Markdown storage not ready");
  return md.getMarkdown();
}

function isEditable(stateName: EditorStateName): boolean {
  return stateName === "editing" || stateName === "dirty";
}

function isLocked(stateName: EditorStateName): boolean {
  return stateName === "saving";
}

export function EditorArea({
  stateName,
  filePath,
  content,
  fileType = "md",
  appliedRanges = [],
  errorMessage,
  onChange,
}: EditorAreaProps) {
  if (stateName === "noWorkspace" || stateName === "idle") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 13,
          userSelect: "none",
        }}
      >
        从左侧文件树中打开一个文件
      </div>
    );
  }

  if (stateName === "loading") {
    return (
      <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        {[90, 75, 60, 85, 50, 70].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 14, width: `${w}%` }} />
        ))}
      </div>
    );
  }

  if (stateName === "error") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--danger)",
          fontSize: 13,
          padding: 24,
          textAlign: "center",
        }}
      >
        {errorMessage ?? "文件加载失败"}
      </div>
    );
  }

  return (
    <TiptapEditorSurface
      stateName={stateName}
      filePath={filePath}
      content={content}
      fileType={fileType}
      appliedRanges={appliedRanges}
      onChange={onChange}
    />
  );
}

function TiptapEditorSurface({
  stateName,
  filePath,
  content,
  fileType = "md",
  appliedRanges = [],
  onChange,
}: Omit<EditorAreaProps, "errorMessage">) {
  const editable = isEditable(stateName);
  const locked = isLocked(stateName);
  const readOnly = !editable || locked;

  const suppressUpdateRef = useRef(true);
  const fileTypeRef = useRef(fileType);
  const onChangeRef = useRef(onChange);
  useEffect(() => { fileTypeRef.current = fileType; });
  useEffect(() => { onChangeRef.current = onChange; });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      suppressUpdateRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "打开文件开始编辑…" }),
      Markdown.configure({ html: false, transformCopiedText: true, transformPastedText: true }),
      GreenAdditionDecoration,
      BlockIdExtension,
    ],
    content,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: e, transaction }) => {
      if (!e.isEditable) return;
      if (suppressUpdateRef.current) return;
      // Guard A: skip transactions that did not change the document content.
      // setEditable() emits an update event with an empty transaction (docChanged=false);
      // selection-only changes also have docChanged=false. Neither should trigger
      // handleEditorChange or USER_EDIT — the serialized content is identical.
      if (!transaction.docChanged) return;
      if (
        transaction.getMeta(greenDecoKey) !== undefined ||
        transaction.getMeta(blockIdPluginKey)?.internal === true
      ) {
        return;
      }
      try {
        const serialized =
          fileTypeRef.current === "txt"
            ? e.getText({ blockSeparator: "\n" })
            : getMarkdownContent(e);
        onChangeRef.current(serialized);
      } catch (err) {
        console.error("Editor serialization failed", err);
      }
    },
  });

  useEffect(() => {
    // Guard B: pass emitUpdate=false so that TipTap does not emit an "update"
    // event when editable state changes (saving→editing, editing→readonly, etc.).
    // The document content does not change on editable toggle; emitting causes
    // a spurious onUpdate → handleEditorChange → USER_EDIT → dirty after every save.
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  // BR-AG-DATA-003: register the active editor in the global registry so that
  // applyDiffReplaceInEditor can locate it during tool execution (AG-TOOL-CALL chain).
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      registerEditor(editor);
    }
    return () => {
      unregisterEditor();
    };
  }, [editor]);

  // BR-DE-UI-002: update GreenAdditionDecoration when appliedRanges change.
  // Dispatches a no-content transaction with plugin meta to recompute decorations.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(
      editor.view.state.tr.setMeta(greenDecoKey, appliedRanges.length > 0 ? appliedRanges : null),
    );
  }, [editor, appliedRanges]);

  useEffect(() => {
    if (!editor) return;
    try {
      const current =
        fileType === "txt"
          ? editor.getText({ blockSeparator: "\n" })
          : getMarkdownContent(editor);
      if (current !== content) {
        suppressUpdateRef.current = true;
        editor.commands.setContent(content, { emitUpdate: false });
        window.queueMicrotask(() => {
          suppressUpdateRef.current = false;
        });
      }
    } catch (err) {
      suppressUpdateRef.current = false;
      console.error("Editor content sync failed", err);
    }
  }, [content, editor, fileType]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px 24px",
        opacity: locked ? 0.6 : 1,
        pointerEvents: locked ? "none" : undefined,
        position: "relative",
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
