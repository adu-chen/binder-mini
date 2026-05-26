/**
 * @GOV
 * codes: BR-AG-UI-001, BR-AG-SEC-001, BR-DE-UI-001, BR-DE-UI-002, BR-DE-UI-003
 * type: RB
 * chain: AG-SEND-MESSAGE, AG-TOOL-CALL, DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF
 * rules: BR-AG-UI-001, BR-AG-SEC-001, BR-DE-UI-001, BR-DE-UI-002, BR-DE-UI-003
 * boundary: in=chatMachine state name, ChatMachineContext fields, InputReferenceDropPayload from drag/drop, DiffEntry list, and apiKeyConfigured boolean | out=ChatPanel rendering MessageList, DiffActionBar, InputReference DropZone, InputReferenceBar, ChatInput, and ProviderConfigPanel
 * term_ref: TERM-AG-002, TERM-AG-004, TERM-DE-001, TERM-DE-012
 */

import { useState } from "react";
import { MessageList } from "./MessageList";
import type { DiffForRender } from "./MessageList";
import { DiffActionBar } from "./DiffActionBar";
import { InputReferenceBar } from "./InputReferenceBar";
import { ChatInput } from "./ChatInput";
import { ProviderConfigPanel } from "./ProviderConfigPanel";
import type { AgentMessage } from "../machines/chatMachine";
import type { InputReference, InputReferenceDropPayload, ProviderConfig } from "../types/agent";
import { readInputReferenceDragPayload, consumePendingDragPayload } from "../utils/inputReferenceDrag";

type ChatStateName =
  | "noWorkspace"
  | "ready"
  | "validatingProvider"
  | "sending"
  | "streaming"
  | "toolCalling"
  | "cancelling"
  | "error";

interface ChatPanelProps {
  stateName: ChatStateName;
  messages: AgentMessage[];
  streamingContent: string;
  inputReferences: InputReference[];
  diffs: DiffForRender[];
  providerConfig: ProviderConfig;
  errorMessage: string | null;
  referenceError: string | null;
  onSend: (content: string) => void;
  onCancel: () => void;
  onRetry: () => void;
  onProviderChange: (provider: ProviderConfig["provider"]) => void;
  onModelChange: (model: string) => void;
  onSaveApiKey: (key: string) => void;
  onRemoveReference: (index: number) => void;
  onCreateTextReference: (content: string) => void;
  onCreateUrlReference: (url: string) => void;
  onDropInputReference: (payload: InputReferenceDropPayload) => void;
  onAcceptDiff: (diffId: string) => void;
  onRejectDiff: (diffId: string) => void;
  /** BR-DE-UI-003: batch-accept all pending/preapplied diffs. */
  onAcceptAll: () => void;
  /** BR-DE-UI-003: batch-reject all pending/preapplied diffs. */
  onRejectAll: () => void;
}

const STREAMING_STATES = new Set<ChatStateName>(["streaming", "toolCalling"]);

export function ChatPanel({
  stateName,
  messages,
  streamingContent,
  inputReferences,
  diffs,
  providerConfig,
  errorMessage,
  referenceError,
  onSend,
  onCancel,
  onRetry,
  onProviderChange,
  onModelChange,
  onSaveApiKey,
  onRemoveReference,
  onCreateTextReference,
  onCreateUrlReference,
  onDropInputReference,
  onAcceptDiff,
  onRejectDiff,
  onAcceptAll,
  onRejectAll,
}: ChatPanelProps) {
  const isStreaming = STREAMING_STATES.has(stateName);
  const [dragDepth, setDragDepth] = useState(0);
  const isReferenceDragOver = dragDepth > 0;

  // BR-DE-UI-003: DiffActionBar shows only when pending/preapplied diffs exist.
  const nonTerminalCount = diffs.filter(
    (d) => d.status === "pending" || d.status === "preapplied",
  ).length;

  function handleReferenceDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragDepth((depth) => depth + 1);
  }

  function handleReferenceDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleReferenceDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragDepth((depth) => Math.max(0, depth - 1));
  }

  function handleReferenceDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragDepth(0);
    // Prefer the in-memory store (WKWebView bypass) over dataTransfer, which
    // returns "" for custom MIME types in Tauri's WKWebView drop handlers.
    const payload = consumePendingDragPayload() ?? readInputReferenceDragPayload(e.dataTransfer);
    if (payload) onDropInputReference(payload);
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg-panel)",
      }}
    >
      {/* NoWorkspace placeholder */}
      {stateName === "noWorkspace" && (
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
          打开 Workspace 后开始对话
        </div>
      )}

      {/* Active chat area */}
      {stateName !== "noWorkspace" && (
        <>
          {/* BR-DE-UI-003: MessageList receives all diffs; DiffCards are rendered inline
              inside each MessageBubble whose toolCallId matches diff.sourceToolId. */}
          <MessageList
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
            allDiffs={diffs}
            onAcceptDiff={onAcceptDiff}
            onRejectDiff={onRejectDiff}
          />

          {/* Error banner */}
          {stateName === "error" && errorMessage && (
            <div
              style={{
                flexShrink: 0,
                padding: "6px 10px",
                background: "var(--diff-error-bg)",
                borderTop: "1px solid var(--danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 12,
                color: "var(--danger)",
              }}
            >
              <span>{errorMessage}</span>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={onRetry}>
                重试
              </button>
            </div>
          )}

          {/* Tool-calling indicator */}
          {stateName === "toolCalling" && (
            <div
              style={{
                flexShrink: 0,
                padding: "4px 12px",
                fontSize: 11,
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              工具调用中…
            </div>
          )}

          {/* BR-DE-UI-003: DiffActionBar — batch accept/reject above InputReferenceBar */}
          <DiffActionBar
            nonTerminalCount={nonTerminalCount}
            onAcceptAll={onAcceptAll}
            onRejectAll={onRejectAll}
          />

          <section
            onDragEnterCapture={handleReferenceDragEnter}
            onDragOverCapture={handleReferenceDragOver}
            onDragLeaveCapture={handleReferenceDragLeave}
            onDropCapture={handleReferenceDrop}
            style={{
              flexShrink: 0,
              outline: isReferenceDragOver ? "1px solid var(--accent)" : "none",
              background: isReferenceDragOver ? "var(--bg-hover)" : undefined,
            }}
          >
            {referenceError && (
              <div
                style={{
                  margin: "6px 8px 0",
                  padding: "5px 8px",
                  border: "1px solid var(--danger)",
                  color: "var(--danger)",
                  fontSize: 12,
                }}
              >
                {referenceError}
              </div>
            )}

            <InputReferenceBar references={inputReferences} onRemove={onRemoveReference} />

            <ChatInput
              stateName={stateName}
              providerConfigured={providerConfig.apiKeyConfigured}
              modelConfigured={providerConfig.model.trim().length > 0}
              hasInputReferences={inputReferences.length > 0}
              onSend={onSend}
              onCancel={onCancel}
              onCreateTextReference={onCreateTextReference}
              onCreateUrlReference={onCreateUrlReference}
            />
          </section>

          <ProviderConfigPanel
            provider={providerConfig.provider}
            model={providerConfig.model}
            apiKeyConfigured={providerConfig.apiKeyConfigured}
            onProviderChange={onProviderChange}
            onModelChange={onModelChange}
            onSaveKey={onSaveApiKey}
          />
        </>
      )}
    </div>
  );
}
