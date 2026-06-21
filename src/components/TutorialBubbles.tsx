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
        const pos = computePosition(r, placement);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => pop(s.id)}
            aria-label={`Got it — dismiss tip: ${s.title}`}
            className="pointer-events-auto absolute w-[min(280px,80vw)] -translate-x-1/2 animate-fade-in cursor-pointer text-left"
            style={{
              top: pos.top,
              left: pos.left,
              animationDelay: `${i * 120}ms`,
            }}
          >
            <div
              className={`relative rounded-2xl border-2 border-primary/50 bg-card/95 px-4 py-3 shadow-glow backdrop-blur-xl ring-1 ring-primary/20 transition-transform hover:scale-[1.03] active:scale-95 ${
                placement === "top" ? "mb-3" : placement === "bottom" ? "mt-3" : ""
              }`}
            >
              <span
                className={`absolute h-3 w-3 rotate-45 border-primary/50 bg-card/95 ${
                  placement === "bottom"
                    ? "left-1/2 -top-1.5 -translate-x-1/2 border-l-2 border-t-2"
                    : placement === "top"
                      ? "left-1/2 -bottom-1.5 -translate-x-1/2 border-r-2 border-b-2"
                      : placement === "left"
                        ? "top-1/2 -right-1.5 -translate-y-1/2 border-r-2 border-t-2"
                        : "top-1/2 -left-1.5 -translate-y-1/2 border-l-2 border-b-2"
                }`}
                aria-hidden
              />
              <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background">
                <X className="h-3 w-3" />
              </span>
              <p className="font-display text-sm font-bold uppercase tracking-wider text-primary">
                {s.title}
              </p>
              <p className="mt-1 text-sm font-medium leading-snug text-foreground">
                {s.body}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Tap to pop ✨
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function computePosition(r: Rect, placement: "top" | "bottom" | "left" | "right") {
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  switch (placement) {
    case "top":    return { top: r.top - 8,           left: cx };
    case "left":   return { top: cy,                  left: r.left - 8 };
    case "right":  return { top: cy,                  left: r.left + r.width + 8 };
    case "bottom":
    default:       return { top: r.top + r.height + 8, left: cx };
  }
}
