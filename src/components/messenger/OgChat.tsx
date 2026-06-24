import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Send, Trash2, Sparkles, Skull, ShieldCheck, Paperclip, Mic, MicOff, Crown, X, Loader2 } from "lucide-react";
import { chatOgBot, type OgChatMessage } from "@/lib/og-messenger.functions";
import { transcribeOgAudio } from "@/lib/og-transcribe.functions";
import { QUICK_STARTS } from "@/lib/og-persona";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useDevMode } from "@/hooks/use-dev-mode";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";
import { useOgMode } from "@/hooks/use-og-mode";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";


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
const LANG_KEY = "og-bot:language";
const OG_LANGUAGES = [
  "English", "Spanish", "French", "Portuguese", "Hindi", "Urdu",
  "Punjabi", "Arabic", "Swahili", "Patois", "Yoruba", "German",
  "Italian", "Filipino", "Tagalog", "Cebuano", "Mandarin", "Japanese",
  "Korean", "Turkish", "Russian", "Polish", "Dutch", "Greek", "Thai",
  "Vietnamese", "Indonesian", "Malay", "Bengali", "Tamil", "Hebrew",
];

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
  /** Optional seeded text to drop in the input (e.g. when opened via "With OG"). */
  seed?: string | null;
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
  seed = null,
}: OgChatProps) {
  const { user } = useAuth();
  const dev = useDevMode();
  const userId = user?.id ?? null;
  const [messages, setMessages] = useState<OgChatMessage[]>(() => loadThread(userId));
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selfSyncRef = useRef(false);
  const chat = useServerFn(chatOgBot);
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { foulMouth } = useFoulMouth();
  const setFoulMouth = useSetFoulMouth();
  const { mode, toggle: toggleMode } = useOgMode();
  const { isVip } = useRole();
  const transcribe = useServerFn(transcribeOgAudio);
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window === "undefined") return "English";
    return window.localStorage.getItem(LANG_KEY) || "English";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LANG_KEY, language);
  }, [language]);

  // Attachment + mic state
  const [attachment, setAttachment] = useState<{ dataUrl: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);

  // Anti-flicker skeleton: stays visible at least 600ms once shown so quick
  // replies don't pop in and out (matches Suno-style "cooking" feel).
  const [showSkeleton, setShowSkeleton] = useState(false);




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

  // Realtime: receive bot messages injected by dev (dev_send_og_message_as_bot).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`og-messages-inbox:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "og_messages",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresInsertPayload<{ role: string; content: string }>) => {
          const row = payload.new;
          if (row.role !== "assistant") return;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && last.content === row.content) {
              return prev;
            }
            return [...prev, { role: "assistant", content: row.content }];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);



  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [userId]);

  // Apply seeded prompt (e.g. from "With OG" CTA on /library).
  useEffect(() => {
    if (seed && seed.trim()) {
      setInput((prev) => (prev.trim() ? prev : seed));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [seed]);

  // Re-scroll while skeleton is mounted so it stays in view.
  useEffect(() => {
    if (showSkeleton) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [showSkeleton]);

  const m = useMutation({
    mutationFn: async (args: { history: OgChatMessage[]; attachmentDataUrl?: string }) =>
      chat({
        data: {
          messages: args.history,
          mode,
          pageContext: typeof window !== "undefined" ? window.location.pathname : "",
          attachmentDataUrl: args.attachmentDataUrl,
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

  // Skeleton stays visible at least 600ms once shown — kills flicker on
  // very fast replies and gives a Suno-style "still cooking" feel.
  useEffect(() => {
    if (m.isPending) {
      setShowSkeleton(true);
      return;
    }
    if (!showSkeleton) return;
    const t = setTimeout(() => setShowSkeleton(false), 600);
    return () => clearTimeout(t);
  }, [m.isPending, showSkeleton]);

  function sendText(text: string) {
    const t = text.trim();
    const att = attachment;
    if (!t && !att) return;
    if (m.isPending) return;
    if (!user) return toast.error("Sign in to chat with OG Bot.");
    if ((profile?.coin_balance ?? 0) <= 0) {
      return toast.error("Out of OG coins — resets to 5 tomorrow, or top up to keep going.");
    }
    const visibleText = t || (att ? `📎 ${att.name}` : "");
    const next = [...messages, { role: "user" as const, content: visibleText }];
    setMessages(next);
    selfSyncRef.current = true;
    window.dispatchEvent(new Event(SYNC_EVENT));
    setInput("");
    setAttachment(null);
    m.mutate({ history: next, attachmentDataUrl: att?.dataUrl });
  }


  function clearChat() {
    setMessages([]);
    selfSyncRef.current = true;
    window.dispatchEvent(new Event(SYNC_EVENT));
    toast.message("Chat cleared");
  }

  async function toggleFoul() {
    if (!isVip) {
      toast.message("Foul-mouth is a VIP perk — grab OG VIP for £5/month.", {
        action: { label: "Get VIP", onClick: () => { window.location.href = "/buy-coins?flow=vip"; } },
      });
      return;
    }
    try {
      const next = !foulMouth;
      await setFoulMouth.mutateAsync(next);
      toast.message(next ? "🖕 Foul mouth: ON" : "🧼 Foul mouth: OFF");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleFile(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("Only images are supported right now.");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("Image too large (max 5MB).");
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Could not read file"));
      r.readAsDataURL(file);
    });
    setAttachment({ dataUrl, name: file.name });
  }

  async function startRecording() {
    if (recording || transcribing) return;
    if (!user) return toast.error("Sign in to use voice.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordChunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && recordChunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunksRef.current, { type: rec.mimeType || "audio/webm" });
        recordChunksRef.current = [];
        if (blob.size < 1024) {
          toast.error("That clip was empty — try again.");
          return;
        }
        setTranscribing(true);
        try {
          const buf = await blob.arrayBuffer();
          // Browser-safe base64 encode
          let binary = "";
          const bytes = new Uint8Array(buf);
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
          }
          const audioBase64 = btoa(binary);
          const res = await transcribe({ data: { audioBase64, mime: blob.type } });
          const text = res.text?.trim();
          if (text) {
            setInput((cur) => (cur ? `${cur} ${text}` : text));
            setTimeout(() => inputRef.current?.focus(), 0);
          } else {
            toast.message("Didn't catch that — try again.");
          }
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied.");
    }
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
    setRecording(false);
  }



  const balance = profile?.coin_balance ?? 0;
  const isOut = balance <= 0;
  const foulActive = mode === "og" && foulMouth;

  return (
    <div
      style={TELEGRAM_FONT_STYLE}
      className={cn(
        "flex h-full flex-col text-[15px] antialiased",
        compact ? "" : "rounded-xl border border-border bg-card",
      )}
    >
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
              {foulActive ? "Foul" : "Turn on OG MODE"}
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
            <div className="w-full max-w-md space-y-6">
              <div className="relative mx-auto h-56 w-56 sm:h-64 sm:w-64">
                <div className="absolute inset-0 rounded-full bg-primary/40 blur-[60px] animate-pulse" />
                <div
                  aria-hidden="true"
                  className="absolute -inset-6 -z-10 opacity-80"
                  style={{
                    background:
                      "radial-gradient(45% 50% at 30% 30%, rgba(239,68,68,0.45), transparent 70%), radial-gradient(50% 55% at 70% 70%, rgba(59,130,246,0.55), transparent 70%)",
                    filter: "blur(28px)",
                  }}
                />
                <img
                  src={ogBotAsset.url}
                  alt="OG Bot"
                  className="relative h-full w-full rounded-full object-cover ring-4 ring-primary/40 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.9)] animate-[bob_3s_ease-in-out_infinite]"
                />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
                  Welcome to <span className="text-gradient-brand">OG Bot</span> 🎤
                </h2>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Your AI studio sidekick. Drop a vibe, a joke, a memory —
                  I'll spin lyrics, hooks &amp; full Suno prompts on demand.
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                  1 coin per message · {balance} left
                </p>
              </div>
              {showQuickStarts && (
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {QUICK_STARTS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => sendText(q.prompt)}
                      disabled={m.isPending || isOut || !user}
                      className="rounded-full border-2 border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-bold text-foreground transition hover:-translate-y-0.5 hover:rotate-[-1deg] hover:border-primary hover:bg-primary/20 active:translate-y-0 disabled:opacity-40"
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
          const initial = dev.isDev ? "D" : (profile?.display_name || user?.email || "Y").trim().charAt(0).toUpperCase();
          return (
            <div
              key={i}
              className={cn(
                "flex items-end gap-3 animate-[pop_0.25s_ease-out]",
                isUser ? "flex-row-reverse" : "flex-row",
              )}
            >
              {isUser ? (
                <div
                  className={cn(
                    "relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-brand text-sm font-black text-primary-foreground shadow-glow",
                    isVip && "ring-2 ring-amber-300 ring-offset-2 ring-offset-background shadow-[0_0_18px_rgba(251,191,36,0.55)]",
                  )}
                >
                  {initial}
                  {isVip && (
                    <Crown
                      className="absolute -top-2 -right-1 h-4 w-4 rotate-[18deg] fill-amber-300 text-amber-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
                      aria-label="VIP"
                    />
                  )}
                </div>
              ) : (
                <OgAvatar size={40} className="shrink-0" />
              )}
              <div className={cn("flex max-w-[75%] flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 text-[10px] font-black uppercase tracking-[0.18em]",
                    isUser ? (isVip ? "text-amber-400" : "text-primary") : "text-foreground/70",
                  )}
                >
                  {isUser ? "You" : "OG Bot"}
                  {isUser && isVip && (
                    <>
                      <Crown className="h-3 w-3 fill-amber-300 text-amber-500" />
                      <span className="text-amber-400">VIP</span>
                    </>
                  )}
                </span>
                <div
                  className={cn(
                    "px-4 py-2.5 text-[15px] leading-[1.45] break-words",
                    isUser
                      ? isVip
                        ? "rounded-2xl rounded-br-sm whitespace-pre-wrap font-medium text-amber-50 bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-700 shadow-[0_8px_24px_-8px_rgba(217,119,6,0.7)] ring-1 ring-amber-300/60"
                        : "rounded-2xl rounded-br-sm bg-primary text-primary-foreground whitespace-pre-wrap font-medium shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)]"
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
        {showSkeleton && (
          <div className="flex items-end gap-3">
            <OgAvatar size={40} className="shrink-0 animate-pulse" />
            <div className="flex flex-col gap-1.5 min-w-[60%] max-w-[78%]">
              <span className="px-2 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/70">
                OG Bot
              </span>
              <div className="rounded-2xl rounded-bl-sm bg-card border-2 border-border px-4 py-3 inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
              </div>
              {/* Shimmering bubble skeletons — Suno-style "still cooking" placeholders */}
              <div className="space-y-1.5">
                <div className="h-3 w-[85%] rounded-md bg-gradient-to-r from-muted via-muted/40 to-muted bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]" />
                <div className="h-3 w-[70%] rounded-md bg-gradient-to-r from-muted via-muted/40 to-muted bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]" />
                <div className="h-3 w-[55%] rounded-md bg-gradient-to-r from-muted via-muted/40 to-muted bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]" />
              </div>
            </div>
          </div>
        )}


      </div>


      {isOut && user && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive sm:px-4">
          <span className="min-w-0 break-words font-semibold">
            You're out of OG coins. Don't sweat — your balance resets to 5 tomorrow.
          </span>
          <Link
            to="/buy-coins"
            className="shrink-0 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 font-bold uppercase tracking-wide hover:bg-destructive/20"
          >
            Top up
          </Link>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendText(input);
        }}
        className="border-t border-border bg-card/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:px-4"
      >
        {attachment && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-2">
            <img src={attachment.dataUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
            <span className="flex-1 truncate text-xs text-muted-foreground">{attachment.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Remove attachment"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {/* Unified composer pill — attachment | mic | textarea | send (Telegram/WhatsApp pattern) */}
        <div
          className={cn(
            "flex items-end gap-1 rounded-3xl border border-border bg-background px-2 py-1.5 shadow-sm transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20",
            (isOut || !user) && "opacity-70",
          )}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!user || m.isPending}
            aria-label="Attach image"
            title="Attach image"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Paperclip className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={!user || m.isPending || transcribing}
            aria-label={recording ? "Stop recording" : "Voice input"}
            title={recording ? "Stop recording" : "Voice input"}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:opacity-40",
              recording
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {transcribing ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : recording ? (
              <MicOff className="h-[18px] w-[18px]" />
            ) : (
              <Mic className="h-[18px] w-[18px]" />
            )}
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.currentTarget;
              el.style.height = "0px";
              el.style.height = Math.min(el.scrollHeight, 160) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText(input);
              }
            }}
            rows={1}
            placeholder={
              transcribing
                ? "Transcribing…"
                : recording
                  ? "Listening… tap mic to stop"
                  : isOut
                    ? "Out of coins — top up to chat"
                    : foulActive
                      ? "Go on then, type something…"
                      : "Message OG Bot…"
            }
            disabled={m.isPending || isOut || !user || transcribing}
            maxLength={2000}
            autoFocus
            className="min-h-[36px] max-h-[160px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] leading-snug placeholder:text-muted-foreground/70 focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={m.isPending || (!input.trim() && !attachment) || isOut || !user}
            aria-label="Send"
            title="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_12px_-4px_hsl(var(--primary)/0.5)] transition hover:scale-105 active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {m.isPending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
          </button>
        </div>
        <p className="mt-1.5 px-2 text-[10px] text-muted-foreground/70">
          Enter to send · Shift+Enter for newline · {balance} coin{balance === 1 ? "" : "s"} left
        </p>
      </form>


    </div>
  );
}
