import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Circle,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import { getMyTelegramChecklist } from "@/lib/telegram-checklist.functions";
import { Button } from "@/components/ui/button";

const STATUS_ICON = {
  ok: CheckCircle2,
  failed: XCircle,
  pending: Circle,
} as const;

const STATUS_TONE = {
  ok: "text-emerald-300",
  failed: "text-red-300",
  pending: "text-amber-300",
} as const;

export function TelegramLinkChecklist() {
  const fn = useServerFn(getMyTelegramChecklist);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["my-telegram-checklist"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (isLoading || !data) {
    return (
      <section className="rounded-2xl border-2 border-border/40 bg-muted/20 p-4 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running Telegram checklist…
        </div>
      </section>
    );
  }

  const tone = data.ready
    ? "border-emerald-400/40 bg-emerald-500/10"
    : data.steps.some((s) => s.status === "failed")
      ? "border-red-400/40 bg-red-500/10"
      : "border-amber-400/40 bg-amber-500/10";

  return (
    <section
      aria-label="Telegram end-to-end checklist"
      className={`rounded-2xl border-2 p-4 backdrop-blur-md ${tone}`}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <h3 className="text-sm font-bold uppercase tracking-[0.18em]">
            Telegram link checklist
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            {data.percent}% · {data.ready ? "Ready" : "In progress"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 px-2"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </header>

      <ol className="space-y-2">
        {data.steps.map((step) => {
          const Icon = STATUS_ICON[step.status];
          return (
            <li
              key={step.id}
              className="flex items-start gap-3 rounded-lg bg-background/30 p-2"
            >
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${STATUS_TONE[step.status]}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{step.label}</p>
                <p className="text-[11px] text-muted-foreground break-words">
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {data.botUsername ? (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          Bot @{data.botUsername}
          {typeof data.pendingUpdates === "number"
            ? ` · ${data.pendingUpdates} pending updates`
            : ""}
        </p>
      ) : null}
    </section>
  );
}
