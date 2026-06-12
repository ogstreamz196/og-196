import { useState, useRef, useEffect } from "react";
import { Bot, X, Sparkles, Send, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "bot" | "user"; text: string };

const QUICK_ACTIONS = [
  { label: "OG, roast my lyric ideas", reply: "Hand 'em over. I'll be merciless — moon/June rhymes get the firing squad, clichés get cremated. Paste the verse." },
  { label: "Unhinged bassline for electronic", reply: "Locked in: 138 BPM, sidechained sub on every kick, distorted Reese growl on the 'and' of 2, half-time drop at bar 16. Want me to push it into the prompt?" },
  { label: "Fix the song structure for a cinematic hook", reply: "Try: intro (8) → swell (8) → hook (16, double the strings) → break (4, kill everything but a pulse) → hook reprise (16) → outro tail. Want me to outline lyrics for that hook?" },
];

const SEED: Msg[] = [
  { role: "bot", text: "Yo — OG Co-Pilot, riding shotgun on this studio session. Pick a quick action below or talk to me. I won't sugarcoat anything." },
];

/**
 * Specialized OG Bot co-pilot embedded inside the Song Studio portal.
 * Self-contained chat with dummy replies + quick actions. Does NOT consume coins.
 */
export function SongStudioCoPilot() {
  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, minimized]);

  function send(text: string, botReply?: string) {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setTimeout(() => {
      setMessages((prev) => [...prev, {
        role: "bot",
        text: botReply ?? "On it. Give me the vibe, BPM, and one reference track and I'll cook a structure you can drop into the prompt above.",
      }]);
    }, 600);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-glow ring-2 ring-primary/30 transition-transform hover:scale-110"
        aria-label="Open Song Studio"
      >
        <Bot className="h-6 w-6" />
        <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-primary/40" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-40 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-primary/30 backdrop-blur-lg",
        "bg-black/55",
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-brand px-4 py-2.5 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-white/15">
            <Bot className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">OG Co-Pilot</div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">Song Studio engine</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized((m) => !m)}
            className="rounded-md p-1 transition-colors hover:bg-white/15"
            aria-label="Minimize"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 transition-colors hover:bg-white/15"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div ref={scrollRef} className="max-h-[280px] space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/8 text-foreground border border-white/10",
                )}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 px-3 py-2">
            <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> Quick actions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => send(q.label, q.reply)}
                  className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-foreground/90 transition hover:border-primary/50 hover:bg-primary/15 hover:text-primary"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-white/10 px-3 py-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask OG anything about your track…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="grid h-8 w-8 place-items-center rounded-full bg-gradient-brand text-primary-foreground disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
