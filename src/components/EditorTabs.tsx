import { writeInputReferenceDragPayload, setPendingDragPayload, clearPendingDragPayload } from "../utils/inputReferenceDrag";

/**
 * @GOV
 * codes: BR-ED-STATE-003, BR-ED-STATE-005
 * type: RB
 * chain: ED-OPEN-FILE
 * rules: BR-ED-STATE-003, BR-ED-STATE-005
 * boundary: in=EditorTab list and activeTabId from editorMachine context | out=EditorTabs bar with dirty indicator and close trigger per EditorTab
 * term_ref: TERM-ED-001, TERM-ED-003
 */

interface EditorTabItem {
  id: string;
  filePath: string;
  dirty: boolean;
}

interface EditorTabsProps {
  tabs: EditorTabItem[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export function EditorTabs({ tabs, activeTabId, onTabClick, onTabClose }: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        overflowX: "auto",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-panel)",
        scrollbarWidth: "none",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const label = tab.filePath.split("/").pop() ?? tab.filePath;

        return (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => {
              const payload = { kind: "file" as const, filePath: tab.filePath };
              writeInputReferenceDragPayload(e.dataTransfer, payload);
              setPendingDragPayload(payload);
            }}
            onDragEnd={() => { clearPendingDragPayload(); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 10px 6px 12px",
              flexShrink: 0,
              cursor: "grab",
              borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              background: isActive ? "var(--bg-elevated)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              fontSize: 13,
              userSelect: "none",
            }}
            onClick={() => onTabClick(tab.id)}
          >
            <span style={{ whiteSpace: "nowrap" }}>
              {label}
              {tab.dirty && (
                <span style={{ color: "var(--text-secondary)", marginLeft: 3 }}>•</span>
              )}
            </span>
            <button
              draggable={false}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              style={{
                color: "var(--text-muted)",
                padding: "0 2px",
                borderRadius: 2,
                lineHeight: 1,
                fontSize: 12,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLButtonElement).style.background = "none";
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
