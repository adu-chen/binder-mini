import { useCallback, useEffect, useRef } from "react";

/**
 * @GOV
 * codes: BR-SYS-UI-002
 * type: RB
 * chain: WS-OPEN
 * rules: BR-SYS-UI-002
 * boundary: in=drag delta from user pointer events | out=panel width update and localStorage persistence for binder-panel-left-width and binder-panel-right-width
 */

interface ResizeHandleProps {
  onDrag: (delta: number) => void;
  onDragEnd: () => void;
}

export function ResizeHandle({ onDrag, onDragEnd }: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  const handleRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onDrag(delta);
    },
    [onDrag]
  );

  const onMouseUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    handleRef.current?.classList.remove("resize-handle--dragging");
    onDragEnd();
  }, [onDragEnd]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return (
    <div
      ref={handleRef}
      className="resize-handle"
      style={{
        width: 4,
        flexShrink: 0,
        cursor: "col-resize",
        background: "var(--border)",
        transition: "background 0.15s",
        userSelect: "none",
      }}
      onMouseDown={(e) => {
        dragging.current = true;
        lastX.current = e.clientX;
        handleRef.current?.classList.add("resize-handle--dragging");
        e.preventDefault();
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        if (!dragging.current)
          (e.currentTarget as HTMLDivElement).style.background = "var(--border)";
      }}
    />
  );
}
