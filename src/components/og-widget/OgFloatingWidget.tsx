import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  MessageSquareMore,
  X,
  Send,
  Sparkles,
  Maximize2,
  Minimize2,
  GripVertical,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDraggable } from "@/hooks/use-draggable-widget";

type Mode = "chill" | "creative" | "og";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const PANEL = { w: 360, h: 520 };
const COMPACT = { w: 360, h: 360 };
const LAUNCHER = { w: 56, h: 56 };

/**
 * Floating draggable OG Bot assistant.
 * Mounted globally inside the authenticated shell.
 * UI-only scaffold — message orchestration wires up later.
 */
export function OgFloatingWidget() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [mode] = useState<Mode>("og");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState("");

  const size = open
    ? isMobile
      ? { w: 0, h: 0 } // mobile uses fixed bottom-sheet layout
      : compact
        ? COMPACT
        : PANEL
    : LAUNCHER;

  const { position, dragging, dragHandlers } = useDraggable({
    size: open && !isMobile ? size : LAUNCHER,
    disabled: isMobile || open, // only the launcher drags; panel stays put
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open && !isMobile) inputRef.current?.focus();
  }, [open, isMobile]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", text },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Assistant is wired up next — for now I'm just here to keep you company.",
      },
    ]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey as never);
    return () => window.removeEventListener("keydown", onKey as never);
  }, [open]);

  // ============ Launcher ============
  if (!open) {
    return (
      <div
        className="pointer-events-auto fixed z-50"
        style={
          isMobile
            ? { right: 16, bottom: 16 }
            : { left: position.x, top: position.y }
        }
      >
        <button
          {...(isMobile ? {} : dragHandlers)}
          onClick={(e) => {
            // Avoid open-on-drag
            if (dragging) {
              e.preventDefault();
              return;
            }
            setOpen(true);
          }}
          aria-label="Open OG assistant"
          className={
            "group relative flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-all hover:scale-105 hover:border-primary/60 hover:shadow-xl " +
            (dragging ? "cursor-grabbing" : "cursor-grab")
          }
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.25),transparent_70%)] opacity-0 transition-opacity group-hover:opacity-100" />
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
            <span className="relative h-3 w-3 rounded-full bg-primary" />
          </span>
        </button>
      </div>
    );
  }

  // ============ Panel ============
  const panelStyle: React.CSSProperties = isMobile
    ? { left: 8, right: 8, bottom: 8, top: "auto", width: "auto", maxHeight: "85vh" }
    : { left: position.x, top: position.y, width: size.w, height: size.h };

  return (
    <div
      role="dialog"
      aria-label="OG assistant"
      className="pointer-events-auto fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl animate-scale-in"
      style={panelStyle}
    >
      {/* Header (drag handle on desktop) */}
      <div
        {...(isMobile ? {} : dragHandlers)}
        className={
          "flex items-center gap-2 border-b border-border/60 bg-gradient-to-r from-card to-card/60 px-3 py-2.5 " +
          (isMobile ? "" : dragging ? "cursor-grabbing" : "cursor-grab")
        }
      >
        {!isMobile && <GripVertical className="h-4 w-4 text-muted-foreground" />}
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-none">OG Assistant</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            mode · <span className="text-primary uppercase">{mode}</span>
          </p>
        </div>
        <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open full Messenger" aria-label="Open full Messenger">
          <Link to="/messenger" onClick={() => setOpen(false)}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCompact((c) => !c)}
            title={compact ? "Expand" : "Compact"}
            aria-label={compact ? "Expand widget" : "Compact widget"}
          >
            {compact ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setOpen(false)}
          title="Close"
          aria-label="Close widget"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm " +
                  (m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground")
                }
              >
                {m.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-background/40 p-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask OG anything…"
            className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button
            size="icon"
            onClick={send}
            disabled={!draft.trim()}
            className="h-9 w-9 shrink-0"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MessageSquareMore className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium">Say hi to OG</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Quick questions, ideas, lyrics — anything. Use the link icon above to open the full
          Messenger.
        </p>
      </div>
    </div>
  );
}
