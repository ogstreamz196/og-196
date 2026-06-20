import { useCallback, useEffect, useRef, useState } from "react";

export interface WidgetPosition {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  initial?: WidgetPosition;
  /** width/height of the draggable surface in px, used to clamp inside viewport */
  size: { w: number; h: number };
  /** disable dragging (mobile) */
  disabled?: boolean;
}

/**
 * Tiny pointer-events drag hook. Session-only state, clamped to viewport.
 */
export function useDraggable({ initial, size, disabled }: UseDraggableOptions) {
  const [position, setPosition] = useState<WidgetPosition>(() =>
    initial ?? defaultPosition(size),
  );
  const [dragging, setDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });
  const handleRef = useRef<HTMLElement | null>(null);

  const clamp = useCallback(
    (p: WidgetPosition): WidgetPosition => {
      if (typeof window === "undefined") return p;
      const maxX = Math.max(8, window.innerWidth - size.w - 8);
      const maxY = Math.max(8, window.innerHeight - size.h - 8);
      return {
        x: Math.min(Math.max(8, p.x), maxX),
        y: Math.min(Math.max(8, p.y), maxY),
      };
    },
    [size.w, size.h],
  );

  // Re-clamp on resize / size change.
  useEffect(() => {
    if (disabled) return;
    const onResize = () => setPosition((p) => clamp(p));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp, disabled]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      const target = e.currentTarget as HTMLElement;
      handleRef.current = target;
      target.setPointerCapture(e.pointerId);
      offset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      setDragging(true);
    },
    [disabled, position.x, position.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setPosition(
        clamp({
          x: e.clientX - offset.current.x,
          y: e.clientY - offset.current.y,
        }),
      );
    },
    [dragging, clamp],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    position,
    setPosition,
    dragging,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}

function defaultPosition(size: { w: number; h: number }): WidgetPosition {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  return {
    x: Math.max(8, window.innerWidth - size.w - 24),
    y: Math.max(8, window.innerHeight - size.h - 24),
  };
}
