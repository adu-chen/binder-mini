/**
 * @GOV
 * codes: BR-AG-UI-001
 * type: RB
 * chain: AG-SEND-MESSAGE
 * rules: BR-AG-UI-001
 * boundary: in=InputReference list from chatMachine context | out=InputReferenceBar tag row showing attached InputReference items with remove trigger per tag
 * term_ref: TERM-AG-002
 */

import type { InputReference } from "../machines/chatMachine";

interface InputReferenceBarProps {
  references: InputReference[];
  onRemove: (index: number) => void;
}

export function InputReferenceBar({ references, onRemove }: InputReferenceBarProps) {
  if (references.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        padding: "6px 8px 0",
      }}
    >
      {references.map((ref, i) => (
        <span
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 4,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          <span style={{ color: "var(--accent)", fontSize: 10 }}>{ref.type}</span>
          <span
            style={{
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {ref.value}
          </span>
          <button
            onClick={() => onRemove(i)}
            style={{
              color: "var(--text-muted)",
              lineHeight: 1,
              padding: "0 1px",
              fontSize: 11,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
