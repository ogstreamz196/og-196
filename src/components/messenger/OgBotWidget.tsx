import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, X, GripVertical } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { OgChat } from "./OgChat";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * Floating, draggable OG Bot widget. Mounted site-wide on authenticated
 * routes. Drag the orb anywhere; position is remembered for the session.
 * Hidden on the dedicated /messenger page so we don't stack two chats.
 */

const POS_KEY = "og-bot:widget-pos";
const ORB_SIZE = 56;
const PANEL_W = 380;
const PANEL_H = 560;
const MARGIN = 8;

type Pos = { x: number; y: number };

function clamp(p: Pos): Pos {
  if (typeof window === "undefined") return p;
  const maxX = window.innerWidth - ORB_SIZE - MARGIN;
  const maxY = window.innerHeight - ORB_SIZE - MARGIN;
  return {
    x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, maxX)),
    y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, maxY)),
  };
}

function loadPos(): Pos {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  try {
    const raw = window.sessionStorage.getItem(POS_KEY);
    if (raw) return clamp(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  // Default: bottom-right
  return clamp({
    x: window.innerWidth - ORB_SIZE - 24,
    y: window.innerHeight - ORB_SIZE - 24,
  });
}

export function OgBotWidget() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(() => loadPos());
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();

  // Persist position (per-session) and re-clamp on resize.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(POS_KEY, JSON.stringify(pos));
  }, [pos]);

  useEffect(() => {
    function onResize() {
      setPos((p) => clamp(p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
    setDragging(true);
  }, [pos.x, pos.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (d.moved) {
      setPos(clamp({ x: d.origX + dx, y: d.origY + dy }));
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDragging(false);
    // If no real drag occurred, treat as a click → toggle panel.
    if (d && !d.moved) {
      setOpen((v) => !v);
    }
  }, []);

  // Compute panel anchor relative to orb (open above-left by default,
  // flipped if the orb is in the top half / right edge).
  function panelStyle(): React.CSSProperties {
    if (typeof window === "undefined") return {};
    const openBelow = pos.y < window.innerHeight / 2;
    const openLeft = pos.x + ORB_SIZE / 2 > window.innerWidth / 2;
    const top = openBelow ? pos.y + ORB_SIZE + 12 : pos.y - PANEL_H - 12;
    const left = openLeft ? pos.x + ORB_SIZE - PANEL_W : pos.x;
    return {
      top: Math.max(MARGIN, Math.min(top, window.innerHeight - PANEL_H - MARGIN)),
      left: Math.max(MARGIN, Math.min(left, window.innerWidth - PANEL_W - MARGIN)),
    };
  }

  if (!user) return null;
  if (pathname === "/messenger") return null;

  return (
    <>
      {open && (
        <div
          style={panelStyle()}
          className={cn(
            "fixed z-50 animate-in fade-in slide-in-from-bottom-2",
            "h-[min(560px,calc(100vh-2rem))] w-[min(380px,calc(100vw-1rem))]",
            "overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/20",
          )}
        >
          <div className="flex items-center justify-between border-b border-border bg-gradient-brand px-4 py-2.5 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="text-sm font-semibold">OG Bot</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 transition-colors hover:bg-white/10"
              aria-label="Close OG Bot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-[calc(100%-44px)]">
            <OgChat compact showHeader />
          </div>
        </div>
      )}

      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ top: pos.y, left: pos.x, touchAction: "none" }}
        className={cn(
          "fixed z-50 grid h-14 w-14 select-none place-items-center rounded-full",
          "bg-gradient-brand text-primary-foreground shadow-glow",
          "transition-transform hover:scale-105",
          dragging ? "scale-110 cursor-grabbing" : "cursor-grab",
        )}
        aria-label={open ? "Close OG Bot" : "Open OG Bot — drag to reposition"}
      >
        {dragging ? (
          <GripVertical className="h-5 w-5" />
        ) : open ? (
          <X className="h-6 w-6" />
        ) : (
          <Bot className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
