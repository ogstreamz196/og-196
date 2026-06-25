import { useEffect, useRef, useState, type ReactNode } from "react";
import { DODGE_QUERIES, shouldDodgeCursor } from "./dodgy-logo-detect";

type Props = {
  children: ReactNode;
  className?: string;
  /** Cursor radius (px) that triggers dodging. */
  dodgeRadius?: number;
  /** Maximum px the text can drift from its anchor. */
  maxDrift?: number;
};

/**
 * Wraps inline/block content so it slides out of the way of the cursor on
 * desktop and snaps back to its anchor when the cursor leaves. On touch it
 * stays perfectly still — never overrides layout.
 */
export function DodgyText({
  children,
  className = "",
  dodgeRadius = 180,
  maxDrift = 40,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const [isFine, setIsFine] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let touched = false;
    const queries = DODGE_QUERIES.map((q) => window.matchMedia(q));
    const update = () => setIsFine(shouldDodgeCursor((q) => window.matchMedia(q), { touched }));
    update();
    queries.forEach((q) => q.addEventListener?.("change", update));
    const onTouch = () => {
      touched = true;
      update();
    };
    window.addEventListener("touchstart", onTouch, { once: true, passive: true });
    return () => {
      queries.forEach((q) => q.removeEventListener?.("change", update));
      window.removeEventListener("touchstart", onTouch);
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (!isFine) {
      el.style.transform = "translate3d(0,0,0)";
      return;
    }

    const tick = () => {
      posRef.current.x += (targetRef.current.x - posRef.current.x) * 0.16;
      posRef.current.y += (targetRef.current.y - posRef.current.y) * 0.16;
      el.style.transform = `translate3d(${posRef.current.x.toFixed(1)}px, ${posRef.current.y.toFixed(1)}px, 0)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - e.clientX;
      const dy = cy - e.clientY;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < dodgeRadius) {
        const strength = (dodgeRadius - dist) / dodgeRadius;
        const push = maxDrift * strength;
        targetRef.current = {
          x: Math.max(-maxDrift, Math.min(maxDrift, (dx / dist) * push)),
          y: Math.max(-maxDrift, Math.min(maxDrift, (dy / dist) * push)),
        };
      } else {
        targetRef.current = { x: 0, y: 0 };
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isFine, dodgeRadius, maxDrift]);

  return (
    <div
      ref={wrapRef}
      className={`${isFine ? "will-change-transform" : ""} ${className}`}
      style={{ transition: isFine ? undefined : "transform 0.3s" }}
    >
      {children}
    </div>
  );
}
