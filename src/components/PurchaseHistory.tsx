import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Loader2, Receipt, ExternalLink, Crown, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  getCoinPurchaseHistory,
  getStripeReceiptUrl,
  refundCoinPurchase,
  type PurchaseRow,
  type StripePurchaseDetails,
} from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useRole } from "@/hooks/use-role";

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function parseStripeRef(ref: string | null): { env: "sandbox" | "live"; sessionId: string } | null {
  if (!ref) return null;
  const m = /^stripe:(sandbox|live):(cs_(?:test|live)_[A-Za-z0-9]+)$/.exec(ref);
  if (!m) return null;
  return { env: m[1] as "sandbox" | "live", sessionId: m[2] };
}

function refundStatusFor(d: StripePurchaseDetails | null | undefined) {
  if (!d) return null;
  if (d.refunded) return { label: "Refunded", tone: "border-destructive/30 bg-destructive/15 text-destructive" };
  if (d.partiallyRefunded) return { label: "Partial refund", tone: "border-amber-500/30 bg-amber-500/15 text-amber-500" };
  return { label: "Paid", tone: "border-emerald-500/30 bg-emerald-500/15 text-emerald-500" };
}

function ReceiptLink({ row }: { row: PurchaseRow }) {
  const stripe = parseStripeRef(row.reference);
  const fetchReceipt = useServerFn(getStripeReceiptUrl);
  const [loading, setLoading] = useState(false);
  if (!stripe) return null;

  async function open() {
    setLoading(true);
    try {
      const env = (() => { try { return getStripeEnvironment(); } catch { return stripe!.env; } })();
      const res = await fetchReceipt({ data: { sessionId: stripe!.sessionId, environment: env } });
      if ("error" in res) { toast.error(res.error); return; }
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't fetch receipt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
      Receipt
    </button>
  );
}

function RefundButton({ row }: { row: PurchaseRow }) {
  const stripe = parseStripeRef(row.reference);
  const refundFn = useServerFn(refundCoinPurchase);
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  if (!stripe) return null;
  const already = row.stripe?.refunded;
  const currency = row.stripe?.currency ?? "gbp";
  const cashAmount = row.stripe?.amountPaid ?? 0;
  const coinAmount = row.amount;

  async function run() {
    if (already) return;
    setLoading(true);
    try {
      const env = (() => { try { return getStripeEnvironment(); } catch { return stripe!.env; } })();
      const res = await refundFn({ data: { sessionId: stripe!.sessionId, environment: env } });
      if ("error" in res) { toast.error(res.error); return; }
      if (res.status === "already_refunded") {
        toast.info(`Already refunded · ${formatMoney(res.refundedAmount, res.currency)}`);
      } else {
        toast.success(`Refunded ${formatMoney(res.refundedAmount, res.currency)}`);
      }
      await qc.invalidateQueries({ queryKey: ["coin-transactions", "me"] });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading || already}
        className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-300 shadow-[0_0_18px_-6px_theme(colors.amber.400)] hover:from-amber-500/30 hover:to-yellow-500/30 disabled:opacity-50"
        title={already ? "Already refunded" : "VIP instant refund"}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crown className="h-3 w-3" />}
        <Undo2 className="h-3 w-3" />
        {already ? "Refunded" : "Instant refund"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-amber-400/40 bg-card p-6 shadow-[0_0_60px_-10px_theme(colors.amber.400)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-400" />
              <h4 className="text-lg font-bold">Confirm instant refund</h4>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This reverses the purchase immediately. The amounts below will be undone.
            </p>

            <dl className="mt-4 space-y-2 rounded-xl border border-border bg-background/50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Cash refunded to card</dt>
                <dd className="font-bold tabular-nums text-foreground">
                  {formatMoney(cashAmount, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Coins removed from balance</dt>
                <dd className="flex items-center gap-1 font-bold tabular-nums text-destructive">
                  −{coinAmount}
                  <Coins className="h-3.5 w-3.5 text-coin" />
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-sm font-bold text-black shadow-[0_0_20px_-4px_theme(colors.amber.400)] hover:brightness-110 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                Refund now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type RangeKey = "all" | "30d" | "90d" | "year";

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "year", label: "Last year", days: 365 },
  { key: "all", label: "All time", days: null },
];

export function PurchaseHistory() {
  const fetcher = useServerFn(getCoinPurchaseHistory);
  const { isVip } = useRole();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["coin-transactions", "me"],
    queryFn: () => fetcher(),
    staleTime: 30_000,
  });

  const [range, setRange] = useState<RangeKey>("30d");

  return (
    <section className="mx-auto mt-10 w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-card">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">Purchase history</h3>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((opt) => {
          const active = range === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              className={
                "rounded-full border px-3 py-1 text-xs font-semibold transition " +
                (active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-destructive">Couldn't load your history.</p>
      ) : (() => {
        const days = RANGE_OPTIONS.find((o) => o.key === range)?.days ?? null;
        const cutoff = days != null ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
        const rows = (data ?? [])
          .filter((row) => row.type === "stripe_purchase" && row.amount > 0)
          .filter((row) => cutoff == null || new Date(row.created_at).getTime() >= cutoff)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (rows.length === 0) {
          return (
            <p className="mt-6 text-sm text-muted-foreground">
              No coin purchases in this range. Try a wider window.
            </p>
          );
        }
        return (
          <ul className="mt-4 divide-y divide-border">
            {rows.map((row) => {
              const refundStatus = refundStatusFor(row.stripe);
              return (
                <li key={row.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">Coin purchase</p>
                      {refundStatus && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${refundStatus.tone}`}>
                          {refundStatus.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatDate(row.created_at)}</span>
                      <ReceiptLink row={row} />
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <div className="flex items-center gap-1.5 font-bold tabular-nums text-emerald-500">
                      +{row.amount}
                      <Coins className="h-4 w-4 text-coin" />
                      <span className="text-[11px] font-medium text-muted-foreground">coins</span>
                    </div>
                    {row.stripe ? (
                      <div className="text-xs tabular-nums text-muted-foreground">
                        Paid <span className="font-semibold text-foreground">{formatMoney(row.stripe.amountPaid, row.stripe.currency)}</span>
                        {row.stripe.amountPaid > 0 && row.amount > 0 && (
                          <span className="ml-1 text-[10px] opacity-70">
                            ({formatMoney(row.stripe.amountPaid / row.amount, row.stripe.currency)}/coin)
                          </span>
                        )}
                      </div>
                    ) : null}
                    {row.stripe && (row.stripe.refunded || row.stripe.partiallyRefunded) && (
                      <div className="text-xs tabular-nums text-destructive">
                        Refunded {formatMoney(row.stripe.refundedAmount, row.stripe.currency)}
                      </div>
                    )}
                    {isVip && parseStripeRef(row.reference) && (
                      <RefundButton row={row} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        );
      })()}
    </section>
  );
}
