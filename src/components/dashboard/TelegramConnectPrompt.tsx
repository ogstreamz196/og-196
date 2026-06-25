import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send, Users, Sparkles, ExternalLink, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  getMyTelegramStatus,
  getMyTelegramLinkToken,
} from "@/lib/telegram-admin.functions";
import { Button } from "@/components/ui/button";

const TELEGRAM_BOT_USERNAME = "OGStreamzBot";

const DISMISS_KEY = "og.telegram.prompt.dismissed";

export function TelegramConnectPrompt() {
  const statusFn = useServerFn(getMyTelegramStatus);
  const tokenFn = useServerFn(getMyTelegramLinkToken);
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(DISMISS_KEY) === "1",
  );
  const [copied, setCopied] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["my-telegram-status"],
    queryFn: () => statusFn(),
    staleTime: 30_000,
  });

  const linked = status?.state === "verified";

  const { data: tokenData } = useQuery({
    queryKey: ["my-telegram-link-token"],
    queryFn: () => tokenFn(),
    enabled: !linked && !dismissed,
    staleTime: 5 * 60_000,
  });

  if (dismissed) return null;

  const startLink = tokenData?.token
    ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${tokenData.token}`
    : `https://t.me/${TELEGRAM_BOT_USERNAME}`;

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
    setDismissed(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(startLink);
      setCopied(true);
      toast.success("Personal start-link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.message("Copy failed — long-press the link instead");
    }
  }

  // After linking we still surface the community CTA, in a compact form.
  if (linked) {
    return (
      <section
        aria-label="Join the OG community"
        className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-cyan-400/40 bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-blue-500/10 px-4 py-3 backdrop-blur-md"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/20 text-cyan-300">
          <Users className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-200">
            Exclusive OG Community
          </p>
          <p className="text-xs text-muted-foreground">
            Live drops, shared messenger threads, and chat with other OG members.
          </p>
        </div>
        <Button
          asChild
          size="sm"
          className="bg-gradient-to-r from-cyan-500 to-blue-500 font-semibold text-white hover:from-cyan-400 hover:to-blue-400"
        >
          <Link to="/messenger" search={{ live: "1" }}>
            Join community <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-label="Connect Telegram"
      className="relative overflow-hidden rounded-3xl border-2 border-sky-400/40 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-fuchsia-500/15 p-5 backdrop-blur-md shadow-[0_20px_60px_-20px_rgba(56,189,248,0.5)]"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss for this session"
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-black/30 text-white/70 transition hover:bg-black/50 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex flex-wrap items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sky-500/25 text-sky-200 shadow-inner">
          <Send className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-200">
            <Sparkles className="h-3 w-3" /> One tap setup
          </p>
          <h2 className="mt-1 text-2xl font-black leading-tight text-white sm:text-3xl">
            Connect Telegram to OG Bot
          </h2>
          <p className="mt-1 text-sm text-white/80 sm:text-base">
            Get OG Bot in your pocket — drops, replies, and song-ready alerts.
            Then join the{" "}
            <span className="font-bold text-cyan-200">EXCLUSIVE OG Community</span>{" "}
            where every member shares one OG-GPT feed.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-sky-500 to-indigo-500 font-bold text-white shadow-lg hover:from-sky-400 hover:to-indigo-400"
            >
              <a href={startLink} target="_blank" rel="noreferrer">
                <Send className="mr-2 h-4 w-4" /> Open OG Bot & tap Start
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-cyan-400/50 bg-cyan-500/10 font-bold text-cyan-100 hover:bg-cyan-500/20"
            >
              <Link to="/messenger" search={{ live: "1" }}>
                <Users className="mr-2 h-4 w-4" /> Join OG Community
              </Link>
            </Button>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              onClick={copyLink}
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> Copy my start-link
                </>
              )}
            </Button>
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-wider text-white/50">
            Your private start-link verifies it's you. Don't share it.
          </p>
        </div>
      </div>
    </section>
  );
}
