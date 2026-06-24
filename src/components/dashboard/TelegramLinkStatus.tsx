import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, MessageCircle, AlertCircle } from "lucide-react";
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

export function TelegramLinkStatus() {
  const statusFn = useServerFn(getMyTelegramStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["my-telegram-status"],
    queryFn: () => statusFn(),
    staleTime: 60_000,
  });

  if (isLoading || !data) return null;

  const linked = data.linked;

  return (
    <section
      aria-label="Telegram connection status"
      className={
        "flex flex-wrap items-center gap-3 rounded-2xl border-2 px-4 py-3 backdrop-blur-md " +
        (linked
          ? "border-emerald-400/40 bg-emerald-500/10"
          : "border-amber-400/40 bg-amber-500/10")
      }
    >
      <span
        className={
          "grid h-10 w-10 place-items-center rounded-xl " +
          (linked ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300")
        }
      >
        {linked ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em]">
          <MessageCircle className="h-4 w-4" />
          Telegram {linked ? "linked" : "not linked"}
        </p>
        <p className="text-xs text-muted-foreground">
          {linked
            ? `Connected${data.username ? ` as @${data.username}` : ""}${
                data.linkedAt ? ` · since ${formatLinkedAt(data.linkedAt)}` : ""
              }`
            : "Ask an admin for your personal start-link to receive OG Bot DMs."}
        </p>
      </div>
      <span
        className={
          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
          (linked
            ? "bg-emerald-500/20 text-emerald-300"
            : "bg-amber-500/20 text-amber-300")
        }
      >
        {linked ? "Linked" : "Pending"}
      </span>
    </section>
  );
}
