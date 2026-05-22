import { useEffect } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import type { MarkdownStorage } from "tiptap-markdown";

/**
 * @GOV
 * codes: BR-ED-PERSIST-002-RB-ED-ED-OPEN-FILE-010,
 *        BR-ED-PERSIST-002-RB-ED-ED-SAVE-FILE-011,
 *        BR-CORE-GOV-001-RB-ED-ED-SAVE-FILE-012
 * type: RB
 * chain: ED-OPEN-FILE, ED-SAVE-FILE
 * rules: BR-ED-PERSIST-002, BR-CORE-GOV-001
 * boundary: in=markdown document content | out=TipTap editor state and markdown logical content | delegate=tiptap-markdown storage
 */
export function MarkdownEditor({
  content,
  readOnly,
  onChange,
  onError,
}: {
  content: string;
  readOnly: boolean;
  onChange: (content: string) => void;
  onError: (message: string | null) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start editing Markdown...",
      }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
    ],
    content,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => {
      try {
        onChange(getMarkdownStorage(updatedEditor).getMarkdown());
        onError(null);
      } catch (error) {
        onError(markdownErrorMessage(error));
      }
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    try {
      const currentMarkdown = getMarkdownStorage(editor).getMarkdown();
      if (currentMarkdown !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
      onError(null);
    } catch (error) {
      onError(markdownErrorMessage(error));
    }
  }, [content, editor, onError]);

  return (
    <div className="markdown-editor-shell">
      <EditorContent editor={editor} />
    </div>
  );
}

function getMarkdownStorage(editor: { storage: unknown }): MarkdownStorage {
  const markdown = (editor.storage as { markdown?: MarkdownStorage }).markdown;
  if (!markdown?.getMarkdown) {
    throw new Error("Markdown extension storage is not ready");
  }
  return markdown;
}

function markdownErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Markdown conversion failed: ${message}`;
}
