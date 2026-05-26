/**
 * @GOV
 * codes: BR-SYS-UI-001, BR-WS-STATE-003
 * type: RB
 * chain: WS-OPEN, WS-CLOSE
 * rules: BR-SYS-UI-001, BR-WS-STATE-003
 * boundary: in=Workspace displayName and rootPath from workspaceMachine context | out=WorkspaceHeader with close trigger for CLOSE_WORKSPACE event
 * term_ref: TERM-CORE-001, TERM-WS-005
 */

interface WorkspaceHeaderProps {
  displayName: string;
  rootPath: string;
  onCloseRequest: () => void;
}

export function WorkspaceHeader({ displayName, rootPath, onCloseRequest }: WorkspaceHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        gap: 8,
      }}
    >
      <span
        title={rootPath}
        style={{
          color: "var(--text-primary)",
          fontWeight: 600,
          fontSize: 13,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {displayName}
      </span>
      <button
        onClick={onCloseRequest}
        title="关闭 Workspace"
        style={{
          flexShrink: 0,
          color: "var(--text-muted)",
          padding: "2px 4px",
          borderRadius: 3,
          fontSize: 14,
          lineHeight: 1,
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
}
