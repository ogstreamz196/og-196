import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { getTelegramWebhookStatus } from "@/lib/telegram-webhook-status.functions";
import { setTelegramWebhook } from "@/lib/telegram-set-webhook.functions";
import { cn } from "@/lib/utils";

function fmtTs(epochSeconds: number | null): string {
  if (!epochSeconds) return "";
  try {
    return new Date(epochSeconds * 1000).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(epochSeconds);
  }
}

export function TelegramWebhookStatus() {
  const probeFn = useServerFn(getTelegramWebhookStatus);
  const setFn = useServerFn(setTelegramWebhook);
  const [registering, setRegistering] = useState(false);
  const q = useQuery({
    queryKey: ["telegram-webhook-status"],
    queryFn: () => probeFn(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  async function registerWebhook() {
    setRegistering(true);
    try {
      const r = await setFn({ data: {} } as never);
      toast.success(
        r.botUsername
          ? `Webhook registered on @${r.botUsername}`
          : "Webhook registered",
        { description: r.url },
      );
      q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not register webhook");
    } finally {
      setRegistering(false);
    }
  }

  const data = q.data;
  const loading = q.isLoading;
  const healthy = !!data?.ok && !data?.lastErrorMessage;
  const degraded = !!data?.ok && !!data?.lastErrorMessage;
  const offline = !!data && !data.ok;

  const tone = loading
    ? "bg-muted text-muted-foreground"
    : healthy
      ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
      : degraded
        ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
        : "bg-destructive/15 text-destructive ring-1 ring-destructive/30";

  const label = loading
    ? "Checking…"
    : healthy
      ? "Delivering"
      : degraded
        ? "Degraded"
        : "Not delivering";

  return (
    <section
      aria-label="Telegram webhook delivery status"
      className="rounded-2xl border-2 border-border/40 bg-card/60 p-4 backdrop-blur-md"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Webhook className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold uppercase tracking-[0.18em]">
              Telegram webhook
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                tone,
              )}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : healthy ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {label}
            </span>
            <button
              type="button"
              onClick={() => q.refetch()}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-muted/40"
              aria-label="Refresh webhook status"
            >
              <RefreshCw
                className={cn("h-3 w-3", q.isFetching && "animate-spin")}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={registerWebhook}
              disabled={registering}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary hover:bg-primary/20 disabled:opacity-60"
              aria-label="Re-register webhook on the active bot"
              title="Point Telegram at this app's webhook using the active bot token"
            >
              {registering ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plug className="h-3 w-3" />
              )}
              Re-register
            </button>
          </div>

          {data?.url ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              <Activity className="mr-1 inline h-3 w-3" />
              <span className="font-mono">{data.url}</span>
            </p>
          ) : !loading ? (
            <p className="mt-1 text-xs text-muted-foreground">
              No webhook is registered with Telegram.
            </p>
          ) : null}

          {data ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-muted/30 p-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Pending
                </dt>
                <dd className="font-mono text-sm">
                  {data.pendingUpdateCount}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Max conns
                </dt>
                <dd className="font-mono text-sm">
                  {data.maxConnections ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  IP
                </dt>
                <dd className="truncate font-mono text-xs">
                  {data.ipAddress ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Allowed
                </dt>
                <dd className="truncate text-xs">
                  {data.allowedUpdates?.length
                    ? data.allowedUpdates.join(", ")
                    : "all"}
                </dd>
              </div>
            </dl>
          ) : null}

          {data?.lastErrorMessage ? (
            <p className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
              Last delivery error{" "}
              {data.lastErrorDate ? `at ${fmtTs(data.lastErrorDate)}` : ""}:{" "}
              {data.lastErrorMessage}
            </p>
          ) : null}

          {offline && data?.error ? (
            <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
              {data.error}
            </p>
          ) : null}

          {data ? (
            <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Checked {new Date(data.checkedAt).toLocaleTimeString()}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
