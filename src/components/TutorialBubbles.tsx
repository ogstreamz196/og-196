import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

export interface TutorialStep {
  id: string;
  selector: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
}

interface Rect { top: number; left: number; width: number; height: number }

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Floating speech-bubble tutorial. Bubbles anchor to elements by CSS selector
 * and stay until the user "pops" them. Dismissed IDs are remembered.
 */
export function TutorialBubbles({
  steps,
  storageKey = "tutorial.dismissed",
}: {
  steps: TutorialStep[];
  storageKey?: string;
}) {
  const [popped, setPopped] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [rects, setRects] = useState<Record<string, Rect | null>>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPopped(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
    setHydrated(true);
  }, [storageKey]);

  const visible = useMemo(
    () => steps.filter((s) => !popped.has(s.id)),
    [steps, popped],
  );

  useLayoutEffect(() => {
    if (!hydrated) return;
    function measure() {
      const next: Record<string, Rect | null> = {};
      for (const s of visible) {
        const el = document.querySelector(s.selector);
        next[s.id] = el ? getRect(el) : null;
      }
      setRects(next);
    }
    function schedule() {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    }
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [hydrated, visible]);

  function pop(id: string) {
    setPopped((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch { /* ignore */ }
      return next;
    });
  }

  if (!hydrated || visible.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden={false}>
      {visible.map((s, i) => {
        const r = rects[s.id];
        if (!r) return null;
        const placement = s.placement ?? "bottom";
        const vw = typeof window !== "undefined" ? window.innerWidth : 360;
        const vh = typeof window !== "undefined" ? window.innerHeight : 640;
        // Tiny pill — keep it out of the way; just an arrow + label.
        const bubbleW = Math.min(vw < 480 ? 170 : 200, vw - 24);
        const pos = computePosition(r, placement, bubbleW, vw, vh);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => pop(s.id)}
            aria-label={`Dismiss tip: ${s.title}`}
            className="pointer-events-auto absolute animate-fade-in cursor-pointer text-left"
            style={{
              top: pos.top,
              left: pos.left,
              width: bubbleW,
              transform: pos.transform,
              animationDelay: `${i * 120}ms`,
            }}
          >
            <div className="relative rounded-full border border-primary/50 bg-card/95 px-3 py-1.5 shadow-glow backdrop-blur-xl">
              <span
                className={`absolute h-2 w-2 rotate-45 border-primary/50 bg-card/95 ${
                  placement === "bottom"
                    ? "left-1/2 -top-1 -translate-x-1/2 border-l border-t"
                    : placement === "top"
                      ? "left-1/2 -bottom-1 -translate-x-1/2 border-r border-b"
                      : placement === "left"
                        ? "top-1/2 -right-1 -translate-y-1/2 border-r border-t"
                        : "top-1/2 -left-1 -translate-y-1/2 border-l border-b"
                }`}
                aria-hidden
              />
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold text-foreground">
                  <span className="text-primary">{s.title}</span>
                  <span className="ml-1 text-muted-foreground">— {s.body}</span>
                </p>
                <X className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function computePosition(
  r: Rect,
  placement: "top" | "bottom" | "left" | "right",
  bubbleW: number,
  vw: number,
  vh: number,
) {
  const GAP = 14;
  const MARGIN = 8;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  let top = 0;
  let left = 0;
  let transform = "";

  switch (placement) {
    case "top":
      top = r.top - GAP;
      left = cx;
      transform = "translate(-50%, -100%)";
      break;
    case "left":
      top = cy;
      left = r.left - GAP;
      transform = "translate(-100%, -50%)";
      break;
    case "right":
      top = cy;
      left = r.left + r.width + GAP;
      transform = "translate(0, -50%)";
      break;
    case "bottom":
    default:
      top = r.top + r.height + GAP;
      left = cx;
      transform = "translate(-50%, 0)";
      break;
  }

  // Clamp horizontally so the bubble stays inside the viewport.
  if (placement === "top" || placement === "bottom") {
    const minLeft = MARGIN + bubbleW / 2;
    const maxLeft = vw - MARGIN - bubbleW / 2;
    if (minLeft <= maxLeft) left = Math.min(Math.max(left, minLeft), maxLeft);
  } else if (placement === "right") {
    const maxLeft = vw - MARGIN - bubbleW;
    if (left > maxLeft) left = Math.max(MARGIN, maxLeft);
  } else if (placement === "left") {
    if (left < MARGIN + bubbleW) left = MARGIN + bubbleW;
  }

  // Clamp vertically to keep the bubble on screen.
  if (placement === "top" && top < MARGIN) top = MARGIN;
  if (placement === "bottom" && top > vh - MARGIN) top = vh - MARGIN;

  return { top, left, transform };
}
