import { useCallback, useState } from "react";
import { ResizeHandle } from "./ResizeHandle";

/**
 * @GOV
 * codes: BR-SYS-UI-001, BR-SYS-UI-002
 * type: RB
 * chain: WS-OPEN, WS-CLOSE
 * rules: BR-SYS-UI-001, BR-SYS-UI-002
 * boundary: in=workspaceMachine state driving panel availability | out=three-column shell layout with ResizeHandle and localStorage-persisted widths for FileTreePanel and ChatPanel
 * term_ref: TERM-WS-005
 */

const LEFT_KEY = "binder-panel-left-width";
const RIGHT_KEY = "binder-panel-right-width";
const LEFT_MIN = 180;
const LEFT_MAX = 480;
const LEFT_DEFAULT = 240;
const RIGHT_MIN = 260;
const RIGHT_MAX = 600;
const RIGHT_DEFAULT = 320;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readWidth(key: string, defaultValue: number): number {
  const stored = localStorage.getItem(key);
  if (stored) {
    const n = Number(stored);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return defaultValue;
}

interface MainLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

export function MainLayout({ leftPanel, centerPanel, rightPanel }: MainLayoutProps) {
  const [leftWidth, setLeftWidth] = useState<number>(() =>
    clamp(readWidth(LEFT_KEY, LEFT_DEFAULT), LEFT_MIN, LEFT_MAX)
  );
  const [rightWidth, setRightWidth] = useState<number>(() =>
    clamp(readWidth(RIGHT_KEY, RIGHT_DEFAULT), RIGHT_MIN, RIGHT_MAX)
  );

  const onDragLeft = useCallback((delta: number) => {
    setLeftWidth((w) => clamp(w + delta, LEFT_MIN, LEFT_MAX));
  }, []);

  const onDragRight = useCallback((delta: number) => {
    setRightWidth((w) => clamp(w - delta, RIGHT_MIN, RIGHT_MAX));
  }, []);

  const persistLeft = useCallback(() => {
    setLeftWidth((w) => {
      localStorage.setItem(LEFT_KEY, String(w));
      return w;
    });
  }, []);

  const persistRight = useCallback(() => {
    setRightWidth((w) => {
      localStorage.setItem(RIGHT_KEY, String(w));
      return w;
    });
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        overflow: "hidden",
        background: "var(--bg-base)",
      }}
    >
      {/* Left panel — FileTreePanel */}
      <div
        style={{
          width: leftWidth,
          flexShrink: 0,
          background: "var(--bg-panel)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {leftPanel}
      </div>

      <ResizeHandle onDrag={onDragLeft} onDragEnd={persistLeft} />

      {/* Center panel — EditorColumn */}
      <div
        style={{
          flex: 1,
          minWidth: 360,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {centerPanel}
      </div>

      <ResizeHandle onDrag={onDragRight} onDragEnd={persistRight} />

      {/* Right panel — ChatPanel */}
      <div
        style={{
          width: rightWidth,
          flexShrink: 0,
          background: "var(--bg-panel)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {rightPanel}
      </div>
    </div>
  );
}
