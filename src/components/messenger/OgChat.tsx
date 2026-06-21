import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Send, Trash2, Sparkles, Skull, ShieldCheck, UploadCloud, Mic, RotateCcw, Crown } from "lucide-react";
import { chatOgBot, type OgChatMessage } from "@/lib/og-messenger.functions";
import { QUICK_STARTS } from "@/lib/og-persona";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";
import { useOgMode } from "@/hooks/use-og-mode";
import { cn } from "@/lib/utils";

/** Telegram-style premium font stack — SF on Apple, Segoe on Windows, Roboto on Android. */
const TELEGRAM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", "Helvetica Neue", Helvetica, Roboto, Arial, sans-serif';
const TELEGRAM_FONT_STYLE: React.CSSProperties = {
  fontFamily: TELEGRAM_FONT_STACK,
  fontFeatureSettings: '"ss01", "cv11", "kern"',
  letterSpacing: "-0.01em",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
};
import ogBotAsset from "@/assets/ogbot.png.asset.json";

function OgAvatar({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={ogBotAsset.url}
      alt="OG Bot"
      width={size}
      height={size}
      className={cn("rounded-full object-cover ring-0 border-0 outline-none select-none pointer-events-none", className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}


const STORAGE_KEY_PREFIX = "og-messenger-thread-v3:";
const SYNC_EVENT = "og-messenger:sync";
const MAX_PERSISTED = 60;

function storageKey(userId: string | null | undefined) {
  return `${STORAGE_KEY_PREFIX}${userId ?? "anon"}`;
}

function loadThread(userId: string | null | undefined): OgChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is OgChatMessage =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    );
  } catch {
    return [];
  }
}

interface OgChatProps {
  /** Compact variant for the floating widget (no outer card chrome). */
  compact?: boolean;
  /** Show the header strip with toggles + clear. */
  showHeader?: boolean;
  /** Show quick-start chips on empty state. */
  showQuickStarts?: boolean;
}

/**
 * Shared OG Bot chat surface. Used by both /messenger and the floating
 * widget. Same backend, same memory, same toggles — synced cross-surface
 * via localStorage + CustomEvent.
 */
export function OgChat({
  compact = false,
  showHeader = false,
  showQuickStarts = true,
}: OgChatProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [messages, setMessages] = useState<OgChatMessage[]>(() => loadThread(userId));
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selfSyncRef = useRef(false);
  const chat = useServerFn(chatOgBot);
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { foulMouth } = useFoulMouth();
  const setFoulMouth = useSetFoulMouth();
  const { mode, toggle: toggleMode } = useOgMode();
  const { isVip } = useRole();


  useEffect(() => {
    setMessages(loadThread(userId));
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify(messages.slice(-MAX_PERSISTED)),
    );
  }, [messages, userId]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== storageKey(userId) || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) setMessages(parsed);
      } catch {
        /* ignore */
      }
    }
    function onLocal() {
      if (selfSyncRef.current) {
        selfSyncRef.current = false;
        return;
      }
      setMessages(loadThread(userId));
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(SYNC_EVENT, onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SYNC_EVENT, onLocal);
    };
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [userId]);

  const m = useMutation({
    mutationFn: async (history: OgChatMessage[]) =>
      chat({
        data: {
          messages: history,
          mode,
          pageContext: typeof window !== "undefined" ? window.location.pathname : "",
        },
      }),
    onSuccess: (res) => {
      setMessages((cur) => {
        const next = [...cur, { role: "assistant" as const, content: res.reply || "…" }];
        selfSyncRef.current = true;
        window.dispatchEvent(new Event(SYNC_EVENT));
        return next;
      });
      qc.invalidateQueries({ queryKey: ["profile"] });
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    onError: (err: Error) => {
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: `⚠️ ${err.message}` },
      ]);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  function sendText(text: string) {
    const t = text.trim();
    if (!t || m.isPending) return;
    if (!user) return toast.error("Sign in to chat with OG Bot.");
    if ((profile?.coin_balance ?? 0) <= 0) {
      return toast.error("You're out of OG coins. Top up to keep chatting.");
    }
    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next);
    selfSyncRef.current = true;
    window.dispatchEvent(new Event(SYNC_EVENT));
    setInput("");
    m.mutate(next);
  }

  function clearChat() {
    setMessages([]);
    selfSyncRef.current = true;
    window.dispatchEvent(new Event(SYNC_EVENT));
    toast.message("Chat cleared");
  }

  async function toggleFoul() {
    try {
      const next = !foulMouth;
      await setFoulMouth.mutateAsync(next);
      toast.message(next ? "🖕 Foul mouth: ON" : "🧼 Foul mouth: OFF");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const balance = profile?.coin_balance ?? 0;
  const isOut = balance <= 0;
  const foulActive = mode === "og" && foulMouth;

  return (
    <div className={cn("flex h-full flex-col", compact ? "" : "rounded-xl border border-border bg-card")}>
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <OgAvatar size={18} />
            <span>
              OG Bot · {balance} coin{balance === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMode}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition",
                mode === "og"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground",
              )}
              title={mode === "og" ? "OG mode — tap for Safe" : "Safe mode — tap for OG"}
            >
              {mode === "og" ? <Sparkles className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              {mode === "og" ? "OG" : "Safe"}
            </button>
            <button
              type="button"
              onClick={toggleFoul}
              disabled={setFoulMouth.isPending || mode === "safe"}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition disabled:opacity-40",
                foulActive
                  ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : "border-border bg-muted text-muted-foreground hover:bg-muted/80",
              )}
              title={
                mode === "safe"
                  ? "Switch to OG mode to enable foul mouth"
                  : foulActive
                    ? "Foul mouth ON — tap for clean"
                    : "Foul mouth OFF — tap to unleash"
              }
              aria-label="Toggle foul mouth"
            >
              {foulActive ? (
                <span className="text-sm leading-none">🖕</span>
              ) : (
                <Skull className="h-3 w-3" />
              )}
              {foulActive ? "Foul" : "Clean"}
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted/80"
                title="Clear chat history"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div className="w-full max-w-sm space-y-3">
              <div className="relative mx-auto h-20 w-20">
                <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl animate-pulse" />
                <OgAvatar size={80} className="relative drop-shadow-[0_0_24px_hsl(var(--primary)/0.7)] animate-[bob_3s_ease-in-out_infinite]" />
              </div>
              <p className="text-base font-black tracking-tight">OG Bot is online 🎤</p>
              <p className="text-xs text-muted-foreground">
                Drop a vibe, a joke, a memory — I'll spin lyrics, hooks &amp; Suno prompts.
                <br />
                <span className="opacity-70">1 coin per message · {balance} left</span>
              </p>
              {showQuickStarts && (
                <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                  {QUICK_STARTS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => sendText(q.prompt)}
                      disabled={m.isPending || isOut || !user}
                      className="rounded-full border-2 border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-bold text-foreground transition hover:-translate-y-0.5 hover:rotate-[-1deg] hover:border-primary hover:bg-primary/15 active:translate-y-0 disabled:opacity-40"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const initial = (profile?.display_name || user?.email || "Y").trim().charAt(0).toUpperCase();
          return (
            <div
              key={i}
              className={cn(
                "flex items-end gap-3 animate-[pop_0.25s_ease-out]",
                isUser ? "flex-row-reverse" : "flex-row",
              )}
            >
              {isUser ? (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-brand text-sm font-black text-primary-foreground shadow-glow">
                  {initial}
                </div>
              ) : (
                <OgAvatar size={40} className="shrink-0" />
              )}
              <div className={cn("flex max-w-[75%] flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
                <span
                  className={cn(
                    "px-2 text-[10px] font-black uppercase tracking-[0.18em]",
                    isUser ? "text-primary" : "text-foreground/70",
                  )}
                >
                  {isUser ? "You" : "OG Bot"}
                </span>
                <div
                  className={cn(
                    "px-4 py-3 text-[15px] leading-relaxed break-words",
                    isUser
                      ? "rounded-2xl rounded-br-sm bg-primary text-primary-foreground whitespace-pre-wrap font-medium shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)]"
                      : "rounded-2xl rounded-bl-sm bg-card border-2 border-border text-foreground shadow-sm",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-headings:my-2 prose-code:text-primary">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {m.isPending && (
          <div className="flex items-end gap-3">
            <OgAvatar size={40} className="shrink-0 animate-pulse" />
            <div className="flex flex-col gap-1.5">
              <span className="px-2 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/70">
                OG Bot
              </span>
              <div className="rounded-2xl rounded-bl-sm bg-card border-2 border-border px-4 py-3 inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
              </div>
            </div>
          </div>
        )}


      </div>


      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendText(input);
        }}
        className="flex flex-col gap-2 border-t border-border p-3"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isOut
              ? "Out of coins — top up to chat"
              : foulActive
                ? "Go on then, type something…"
                : "Message OG Bot…"
          }
          disabled={m.isPending || isOut || !user}
          maxLength={2000}
          autoFocus
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => toast.message("Attachments coming soon")}
            aria-label="Attach file"
            title="Attach file"
          >
            <UploadCloud className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => toast.message("Voice input coming soon")}
            aria-label="Voice input"
            title="Voice input"
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={clearChat}
            disabled={messages.length === 0}
            aria-label="Reset chat"
            title="Reset chat"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="ml-auto">
            <Button
              type="submit"
              disabled={m.isPending || !input.trim() || isOut || !user}
              aria-label="Send"
              className="gap-2"
            >
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
        </div>
      </form>

    </div>
  );
}
