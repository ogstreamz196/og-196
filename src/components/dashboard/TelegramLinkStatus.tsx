import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, MessageCircle, AlertCircle, Loader2, XCircle } from "lucide-react";
import { getMyTelegramStatus } from "@/lib/telegram-admin.functions";

function formatLinkedAt(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type Tone = {
  border: string;
  bg: string;
  iconBg: string;
  iconText: string;
  pill: string;
};

const TONES: Record<"verified" | "failed" | "pending" | "unlinked", Tone> = {
  verified: {
    border: "border-emerald-400/40",
    bg: "bg-emerald-500/10",
    iconBg: "bg-emerald-500/20",
    iconText: "text-emerald-300",
    pill: "bg-emerald-500/20 text-emerald-300",
  },
  failed: {
    border: "border-red-400/40",
    bg: "bg-red-500/10",
    iconBg: "bg-red-500/20",
    iconText: "text-red-300",
    pill: "bg-red-500/20 text-red-300",
  },
  pending: {
    border: "border-amber-400/40",
    bg: "bg-amber-500/10",
    iconBg: "bg-amber-500/20",
    iconText: "text-amber-300",
    pill: "bg-amber-500/20 text-amber-300",
  },
  unlinked: {
    border: "border-amber-400/40",
    bg: "bg-amber-500/10",
    iconBg: "bg-amber-500/20",
    iconText: "text-amber-300",
    pill: "bg-amber-500/20 text-amber-300",
  },
};

export function TelegramLinkStatus() {
  const statusFn = useServerFn(getMyTelegramStatus);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["my-telegram-status"],
    queryFn: () => statusFn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <section
        aria-label="Telegram connection status"
        className="flex items-center gap-3 rounded-2xl border-2 border-border/40 bg-muted/20 px-4 py-3 backdrop-blur-md"
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Checking Telegram link…
        </span>
      </section>
    );
  }

  const state = data.state;
  const tone = TONES[state];

  const label =
    state === "verified"
      ? "Verified"
      : state === "failed"
        ? "Verification failed"
        : state === "pending"
          ? "Pending verification"
          : "Not linked";

  const headline =
    state === "verified"
      ? "Telegram linked"
      : state === "failed"
        ? "Telegram link broken"
        : state === "pending"
          ? "Telegram pending"
          : "Telegram not linked";

  const detail =
    state === "verified"
      ? `Connected${data.username ? ` as @${data.username}` : ""}${
          data.linkedAt ? ` · since ${formatLinkedAt(data.linkedAt)}` : ""
        }`
      : state === "failed"
        ? `OG Bot couldn't reach your chat${data.verifyError ? ` — ${data.verifyError}` : ""}. Re-open the bot and tap Start.`
        : state === "pending"
          ? "Open the OG Bot start-link in Telegram and tap Start to finish verification."
          : "Ask an admin for your personal start-link to receive OG Bot DMs.";

  const Icon =
    state === "verified"
      ? CheckCircle2
      : state === "failed"
        ? XCircle
        : state === "pending"
          ? Loader2
          : AlertCircle;

  return (
    <section
      aria-label="Telegram connection status"
      className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 px-4 py-3 backdrop-blur-md ${tone.border} ${tone.bg}`}
    >
      <span
        className={`grid h-10 w-10 place-items-center rounded-xl ${tone.iconBg} ${tone.iconText}`}
      >
        <Icon
          className={`h-5 w-5 ${state === "pending" ? "animate-spin" : ""}`}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em]">
          <MessageCircle className="h-4 w-4" />
          {headline}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <span
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone.pill}`}
      >
        {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {label}
      </span>
    </section>
  );
}
