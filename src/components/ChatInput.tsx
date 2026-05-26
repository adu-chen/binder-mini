/**
 * @GOV
 * codes: BR-AG-UI-001
 * type: RB
 * chain: AG-SEND-MESSAGE
 * rules: BR-AG-UI-001
 * boundary: in=chatMachine state name, inputReferences count, paste text, and provider readiness | out=ChatInput textarea with paste-created InputReference callbacks and send/cancel controls
 * term_ref: TERM-AG-002
 */

import { useRef, useState } from "react";

type ChatStateName =
  | "noWorkspace"
  | "ready"
  | "validatingProvider"
  | "sending"
  | "streaming"
  | "toolCalling"
  | "cancelling"
  | "error";

interface ChatInputProps {
  stateName: ChatStateName;
  providerConfigured: boolean;
  modelConfigured: boolean;
  hasInputReferences: boolean;
  onSend: (content: string) => void;
  onCancel: () => void;
  onCreateTextReference: (content: string) => void;
  onCreateUrlReference: (url: string) => void;
}

const ACTIVE_STATES: ReadonlySet<ChatStateName> = new Set([
  "sending",
  "streaming",
  "toolCalling",
  "cancelling",
]);

export function ChatInput({
  stateName,
  providerConfigured,
  modelConfigured,
  hasInputReferences,
  onSend,
  onCancel,
  onCreateTextReference,
  onCreateUrlReference,
}: ChatInputProps) {
  const [draft, setDraft] = useState("");
  // BR-AG-UI-001: WebKit (Tauri WKWebView) fires compositionend BEFORE keydown,
  // so e.nativeEvent.isComposing is already false by the time handleKeyDown runs.
  // A ref + setTimeout(0) bridges the gap: compositionEnd sets the flag via a
  // macrotask callback; the confirming keydown fires synchronously before that
  // macrotask, so isComposingRef.current is still true and send is suppressed.
  const isComposingRef = useRef(false);

  const isActive = ACTIVE_STATES.has(stateName);
  const isCancelling = stateName === "cancelling";
  // BR-AG-STATE-001: allow sending from "error" state so the user does not need to
  // manually click "重试" after configuring an API key or correcting model settings.
  // chatMachine handles SEND_MESSAGE from "error" by clearing the prior error first.
  const canSend =
    (stateName === "ready" || stateName === "error") &&
    providerConfigured && modelConfigured && (draft.trim().length > 0 || hasInputReferences);
  const disabled = stateName === "noWorkspace";

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // BR-AG-UI-001: guard IME composition via isComposingRef (not e.nativeEvent.isComposing).
    // WebKit (Tauri WKWebView) fires compositionend BEFORE keydown, so isComposing is
    // already false when this handler runs. isComposingRef stays true until the
    // setTimeout(0) callback in onCompositionEnd fires as a macrotask — after this keydown.
    if (e.key === "Enter" && !isComposingRef.current && !e.shiftKey && canSend) {
      e.preventDefault();
      const content = draft.trim() || "请基于引用内容处理。";
      setDraft("");
      onSend(content);
    }
  }

  function handleSend() {
    if (!canSend) return;
    const content = draft.trim() || "请基于引用内容处理。";
    setDraft("");
    onSend(content);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = e.clipboardData.getData("text/plain");
    if (!pasted.trim()) return;
    e.preventDefault();
    const trimmed = pasted.trim();
    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      onCreateUrlReference(trimmed);
    } else {
      onCreateTextReference(pasted);
    }
  }

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: "1px solid var(--border)",
        padding: "8px 8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => { setTimeout(() => { isComposingRef.current = false; }, 0); }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={
          disabled
            ? "请先打开 Workspace"
            : !providerConfigured
            ? "请先配置 API Key"
            : !modelConfigured
            ? "请先填写模型名称"
            : "输入消息，Enter 发送（Shift+Enter 换行）"
        }
        disabled={disabled || isActive}
        rows={3}
        style={{
          resize: "none",
          fontSize: 13,
          lineHeight: 1.5,
          opacity: disabled || isActive ? 0.5 : 1,
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        {isActive && (
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isCancelling}
            style={{ opacity: isCancelling ? 0.5 : 1 }}
          >
            {isCancelling ? "取消中…" : "取消"}
          </button>
        )}
        {!isActive && (
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={!canSend}
            style={{ opacity: canSend ? 1 : 0.4 }}
          >
            发送
          </button>
        )}
      </div>
    </div>
  );
}
