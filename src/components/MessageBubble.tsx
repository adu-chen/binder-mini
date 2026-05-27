/**
 * @GOV
 * codes: BR-AG-UI-001, BR-DE-UI-001, BR-DE-UI-003
 * type: RB
 * chain: AG-SEND-MESSAGE, DE-ACCEPT-DIFF, DE-REJECT-DIFF
 * rules: BR-AG-UI-001, BR-DE-UI-001, BR-DE-UI-003
 * boundary: in=AgentMessage role, content string, and optional DiffCard list linked by toolCallId | out=MessageBubble visual block with role-distinct alignment and background; assistant messages with toolCallId render associated DiffCards below bubble content
 * term_ref: TERM-AG-002, TERM-DE-001, TERM-DE-011
 */

import { DiffCard } from "./DiffCard";
import { InputReferenceTags } from "./InputReferenceBar";
import type { PendingDiffStatus } from "../machines/diffMachine";
import type { InputReference } from "../types/agent";

export interface DiffForBubble {
  diffId: string;
  filePath: string;
  originalText: string;
  newText: string;
  status: PendingDiffStatus;
}

interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  isStreaming?: boolean;
  inputReferences?: InputReference[];
  /** BR-DE-UI-003: DiffCards linked to this message via toolCallId ↔ sourceToolId. */
  diffs?: DiffForBubble[];
  onAcceptDiff?: (diffId: string) => void;
  onRejectDiff?: (diffId: string) => void;
}

const BUBBLE_STYLES: Record<
  "user" | "assistant" | "system" | "tool",
  { align: "flex-end" | "flex-start"; bg: string; color: string }
> = {
  user: {
    align: "flex-end",
    bg: "var(--accent)",
    color: "var(--text-primary)",
  },
  assistant: {
    align: "flex-start",
    bg: "var(--bg-elevated)",
    color: "var(--text-primary)",
  },
  system: {
    align: "flex-start",
    bg: "transparent",
    color: "var(--text-muted)",
  },
  /** BR-AG-DATA-002: tool result messages are rendered as muted protocol indicators. */
  tool: {
    align: "flex-start",
    bg: "transparent",
    color: "var(--text-muted)",
  },
};

export function MessageBubble({
  role,
  content,
  isStreaming = false,
  inputReferences,
  diffs,
  onAcceptDiff,
  onRejectDiff,
}: MessageBubbleProps) {
  const { align, bg, color } = BUBBLE_STYLES[role];
  const hasDiffs = diffs && diffs.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "flex-end" ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "85%",
          padding: role === "system" ? "2px 0" : "8px 12px",
          borderRadius: 8,
          background: bg,
          color,
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontStyle: role === "system" ? "italic" : undefined,
        }}
      >
        {content}
        {isStreaming && (
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 13,
              background: "var(--text-secondary)",
              marginLeft: 3,
              verticalAlign: "middle",
              borderRadius: 1,
              animation: "blink 1s step-start infinite",
            }}
          />
        )}
      </div>

      {role === "user" && inputReferences && inputReferences.length > 0 && (
        <InputReferenceTags
          references={inputReferences}
          style={{
            maxWidth: "85%",
            justifyContent: "flex-end",
            marginTop: 4,
          }}
        />
      )}

      {/* BR-DE-UI-003: DiffCards linked to this assistant message via toolCallId ↔ sourceToolId */}
      {hasDiffs && (
        <div
          style={{
            maxWidth: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 6,
          }}
        >
          {diffs.map((d) => (
            <DiffCard
              key={d.diffId}
              diffId={d.diffId}
              filePath={d.filePath}
              originalText={d.originalText}
              newText={d.newText}
              status={d.status}
              onAccept={onAcceptDiff ?? (() => {})}
              onReject={onRejectDiff ?? (() => {})}
            />
          ))}
        </div>
      )}
    </div>
  );
}
