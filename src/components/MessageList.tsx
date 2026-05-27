/**
 * @GOV
 * codes: BR-AG-UI-001, BR-DE-UI-003
 * type: RB
 * chain: AG-SEND-MESSAGE, DE-ACCEPT-DIFF, DE-REJECT-DIFF
 * rules: BR-AG-UI-001, BR-DE-UI-003
 * boundary: in=AgentMessage list, streaming content string, and DiffEntry list with sourceToolId | out=scrollable MessageList with per-message DiffCards injected below the assistant bubble whose toolCallId matches diff.sourceToolId
 * term_ref: TERM-AG-002, TERM-DE-001, TERM-DE-011
 */

import { useEffect, useMemo, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { DiffForBubble } from "./MessageBubble";
import type { AgentMessage } from "../machines/chatMachine";
import type { PendingDiffStatus } from "../machines/diffMachine";

export interface DiffForRender extends DiffForBubble {
  /** BR-DE-UI-003: links this entry to the assistant message via AgentMessage.toolCallId. */
  sourceToolId: string;
}

interface MessageListProps {
  messages: AgentMessage[];
  streamingContent: string;
  isStreaming: boolean;
  allDiffs?: DiffForRender[];
  onAcceptDiff?: (diffId: string) => void;
  onRejectDiff?: (diffId: string) => void;
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
  allDiffs,
  onAcceptDiff,
  onRejectDiff,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (!shouldStickToBottomRef.current) return;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      node.scrollTop = node.scrollHeight;
    });

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [messages.length, streamingContent]);

  function handleScroll() {
    const node = scrollRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 80;
  }

  // BR-DE-UI-003: group diffs by sourceToolId so each MessageBubble receives
  // only the diffs whose sourceToolId matches the bubble's toolCallId.
  const diffsByToolCallId = useMemo(() => {
    const map = new Map<string, DiffForBubble[]>();
    for (const d of allDiffs ?? []) {
      const existing = map.get(d.sourceToolId) ?? [];
      map.set(d.sourceToolId, [...existing, d]);
    }
    return map;
  }, [allDiffs]);

  if (messages.length === 0 && !isStreaming) {
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
        发送消息开始对话
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: "auto",
        overflowAnchor: "none",
        padding: "12px 12px 4px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          inputReferences={msg.inputReferences}
          diffs={msg.toolCallId ? diffsByToolCallId.get(msg.toolCallId) : undefined}
          onAcceptDiff={onAcceptDiff}
          onRejectDiff={onRejectDiff}
        />
      ))}
      {isStreaming && streamingContent && (
        <MessageBubble role="assistant" content={streamingContent} isStreaming />
      )}
    </div>
  );
}
