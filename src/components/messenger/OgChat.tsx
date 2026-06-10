import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Bot, KeyRound, LogOut } from "lucide-react";
import { chatOgBot, type OgChatMessage } from "@/lib/og-messenger.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "og-messenger-thread-v1";
const TOKEN_KEY = "og-messenger-token-v1";

function loadThread(): OgChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

export function OgChat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<OgChatMessage[]>(() => loadThread());
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(TOKEN_KEY) ?? "";
  });
  const [tokenDraft, setTokenDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const selfSyncRef = useRef(false);
  const chat = useServerFn(chatOgBot);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
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
      setMessages(loadThread());
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("og-messenger:sync", onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("og-messenger:sync", onLocal);
    };
  }, []);

  const m = useMutation({
    mutationFn: async (history: OgChatMessage[]) => chat({ data: { messages: history } }),
    onSuccess: (res) => {
      setMessages((cur) => {
        const next = [...cur, { role: "assistant" as const, content: res.reply || "..." }];
        selfSyncRef.current = true;
        window.dispatchEvent(new Event("og-messenger:sync"));
        return next;
      });
    },
    onError: (err: Error) => {
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: `⚠️ ${err.message}` },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, m.isPending]);

  function send() {
    const text = input.trim();
    if (!text || m.isPending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    selfSyncRef.current = true;
    window.dispatchEvent(new Event("og-messenger:sync"));
    setInput("");
    m.mutate(next);
  }

  return (
    <div className={cn("flex h-full flex-col", compact ? "" : "rounded-xl border border-border bg-card")}>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-xs space-y-2">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-brand shadow-glow">
                <Bot className="h-6 w-6 text-primary-foreground" />
              </div>
              <p className="text-sm font-semibold">OG Bot is online</p>
              <p className="text-xs text-muted-foreground">
                Ask about songs, coins, portals, or whatever's on your mind.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm",
                msg.role === "user"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-muted text-foreground",
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {m.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message OG Bot…"
          disabled={m.isPending}
          maxLength={2000}
        />
        <Button type="submit" size="icon" disabled={m.isPending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
