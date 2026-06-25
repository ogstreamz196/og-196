import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, GripVertical, ChevronDown } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { OgChat } from "./OgChat";
import { useAuth } from "@/hooks/use-auth";
import { useFoulMouth } from "@/hooks/use-foul-mouth";
import { useOgMode } from "@/hooks/use-og-mode";
import { cn } from "@/lib/utils";
import { ogWidget, useOgWidgetState } from "@/stores/og-widget";
import ogBotAsset from "@/assets/ogbot.png.asset.json";

/**
 * Page-aware quick-prompt chips for the floating widget. Tuned to the
 * route the user is on plus their saved OG settings (mode + foul mouth).
 */
function buildQuickPrompts(
  pathname: string,
  mode: "safe" | "savage" | string,
  foulMouth: boolean,
): { label: string; prompt: string }[] {
  const spice = foulMouth ? "Don't hold back — keep it raw." : "Keep it clean.";
  const tone = mode === "savage" ? "Savage mode — roast me a little." : "Friendly tone.";

  if (pathname.startsWith("/library")) {
    return [
      { label: "🎵 New song", prompt: `Help me start a brand new song from scratch. Ask me mood, genre, and vibe first. ${tone}` },
      { label: "💌 From a memory", prompt: `I want to turn a memory into a song. Ask me whose memory, when, and the feeling. ${spice}` },
      { label: "🎚️ Suno prompt", prompt: "I just need a ready-to-paste Suno prompt. Ask the key details, then output one tight prompt." },
      { label: "🪝 Sticky chorus", prompt: "Help me write a sticky chorus. Start by asking what the song is about." },
    ];
  }
  if (pathname.startsWith("/portal") || pathname.startsWith("/dashboard")) {
    return [
      { label: "📈 What next?", prompt: "Look at my recent activity and suggest the next 3 things I should do in OG today." },
      { label: "💡 Title ideas", prompt: "Give me 5 fresh song title ideas. Ask me mood and genre first." },
      { label: "🎵 Co-write", prompt: `Let's co-write a song together. Ask me what's on my mind. ${tone}` },
    ];
  }
  if (pathname.startsWith("/settings")) {
    return [
      { label: "⚙️ Explain settings", prompt: "Walk me through what each OG setting does and which ones you'd recommend for me." },
      { label: "🪙 How coins work", prompt: "Explain how OG coins work, what costs what, and how I can earn more." },
    ];
  }
  return [
    { label: "🎵 Song for someone", prompt: `Help me write a personalised song for someone in my life. Ask me who it's for, their name, their age or vibe, and how they want to be portrayed — then take it from there. ${tone}` },
    { label: "💡 Title ideas", prompt: "Give me 5 fresh song title ideas. Ask me who the song is for, their vibe, mood and genre first." },
    { label: "🪝 Sticky chorus", prompt: "Help me write a sticky chorus. Start by asking who the song is for and what you want to say about them." },
    { label: "🎚️ Suno prompt", prompt: "I just need a Suno-ready prompt. Ask who the song is for, their vibe and how to portray them, then output one tight prompt." },
  ];
}

const POS_KEY = "og-bot:widget-pos";
const ORB_SIZE = 56;
const PANEL_W = 380;
const PANEL_H = 580;
const MARGIN = 12;
const MOBILE_BP = 640;

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
  return clamp({
    x: window.innerWidth - ORB_SIZE - 24,
    y: window.innerHeight - ORB_SIZE - 24,
  });
}

export function OgBotWidget() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(() => loadPos());
  const [dragging, setDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BP : false,
  );
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const external = useOgWidgetState();
  const { foulMouth } = useFoulMouth();
  const { mode } = useOgMode();
  const [chipsHidden, setChipsHidden] = useState(false);
  const quickPrompts = useMemo(
    () => buildQuickPrompts(pathname, mode, foulMouth),
    [pathname, mode, foulMouth],
  );

  useEffect(() => {
    if (open) setChipsHidden(false);
  }, [open]);

  useEffect(() => {
    if (external.open && !open) setOpen(true);
  }, [external.open, open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(POS_KEY, JSON.stringify(pos));
  }, [pos]);

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < MOBILE_BP);
      setPos((p) => clamp(p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Lock body scroll when the mobile sheet is open.
  useEffect(() => {
    if (!isMobile || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, open]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
        moved: false,
      };
      setDragging(true);
    },
    [pos.x, pos.y],
  );

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
    if (d && !d.moved) {
      setOpen((v) => !v);
    }
  }, []);

  function panelStyle(): React.CSSProperties {
    if (typeof window === "undefined") return {};
    const w = Math.min(PANEL_W, window.innerWidth - MARGIN * 2);
    const h = Math.min(PANEL_H, window.innerHeight - MARGIN * 2);
    const openBelow = pos.y < window.innerHeight / 2;
    const openLeft = pos.x + ORB_SIZE / 2 > window.innerWidth / 2;
    const top = openBelow ? pos.y + ORB_SIZE + 12 : pos.y - h - 12;
    const left = openLeft ? pos.x + ORB_SIZE - w : pos.x;
    return {
      top: Math.max(MARGIN, Math.min(top, window.innerHeight - h - MARGIN)),
      left: Math.max(MARGIN, Math.min(left, window.innerWidth - w - MARGIN)),
      width: w,
      height: h,
    };
  }

  if (!user) return null;
  if (pathname === "/messenger") return null;

  const showPanel = open;

  return (
    <>
      {/* Mobile backdrop */}
      {showPanel && isMobile && (
        <div
          onClick={() => {
            setOpen(false);
            ogWidget.close();
          }}
          className="fixed inset-0 z-40 animate-in fade-in bg-background/70 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      {showPanel && (
        <div
          style={isMobile ? undefined : panelStyle()}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border border-border/80 bg-card shadow-2xl shadow-primary/20",
            isMobile
              ? "inset-x-0 bottom-0 top-auto h-[88vh] rounded-t-3xl animate-in slide-in-from-bottom"
              : "rounded-2xl animate-in fade-in slide-in-from-bottom-2",
          )}
        >
          {/* Header — branded avatar + close (matches chat-ui-composition agent-identity rule) */}
          <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-gradient-brand px-3.5 py-2.5 text-primary-foreground">
            {isMobile && (
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-primary-foreground/30"
              />
            )}
            <div className="flex min-w-0 items-center gap-2.5">
              <img
                src={ogBotAsset.url}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full ring-2 ring-primary-foreground/40 object-cover"
                draggable={false}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight">OG Bot</p>
                <p className="truncate text-[10px] leading-tight text-primary-foreground/75">
                  online · ready to cook
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                ogWidget.close();
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-primary-foreground/15 active:scale-95"
              aria-label="Close OG Bot"
            >
              {isMobile ? <ChevronDown className="h-5 w-5" /> : <X className="h-4 w-4" />}
            </button>
          </div>

          {/* Quick prompts — fade edges, dismissible */}
          {!chipsHidden && quickPrompts.length > 0 && (
            <div className="relative shrink-0 border-b border-border/60 bg-muted/30">
              <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {quickPrompts.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      ogWidget.open(q.prompt);
                      setChipsHidden(true);
                    }}
                    className="shrink-0 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold text-foreground/90 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary hover:text-primary-foreground active:translate-y-0"
                  >
                    {q.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setChipsHidden(true)}
                  aria-label="Hide suggestions"
                  className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-muted/60 to-transparent"
              />
            </div>
          )}

          <div className="min-h-0 flex-1">
            <OgChat compact showHeader seed={external.open ? external.seed : null} />
          </div>
        </div>
      )}

      {/* Floating orb — hidden on mobile while sheet is open (sheet covers it) */}
      {!(isMobile && showPanel) && (
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ top: pos.y, left: pos.x, touchAction: "none" }}
          className={cn(
            "fixed z-50 grid h-24 w-24 sm:h-28 sm:w-28 select-none place-items-center overflow-hidden rounded-full",
            "bg-gradient-brand text-primary-foreground shadow-glow ring-2 ring-primary-foreground/20",
            "transition-transform hover:scale-105 active:scale-95",
            dragging ? "scale-110 cursor-grabbing" : "cursor-grab",
          )}
          aria-label={open ? "Close OG Bot" : "Open OG Bot — drag to reposition"}
        >
          {dragging ? (
            <GripVertical className="h-8 w-8" />
          ) : open ? (
            <X className="h-9 w-9" />
          ) : (
            <>
              <img
                src={ogBotAsset.url}
                alt=""
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover"
                draggable={false}
              />
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-primary bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
              />
            </>
          )}
        </button>
      )}
    </>
  );
}
