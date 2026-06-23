import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Loader2, Receipt, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getCoinPurchaseHistory, getStripeReceiptUrl, type PurchaseRow } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function labelForType(type: string) {
  switch (type) {
    case "stripe_purchase": return "Coin purchase";
    case "referral_cashback": return "Referral cashback";
    case "referral_bonus": return "Referral bonus";
    case "admin_mint":
    case "mint": return "Admin grant";
    case "admin_deduct": return "Admin deduction";
    case "generation": return "Song generation";
    case "refund": return "Refund";
    case "bonus": return "Welcome bonus";
    case "vip_purchase":
    case "vip_grant": return "VIP membership";
    case "vip_revoke": return "VIP revoked";
    case "bot_token_purchase": return "Bot token purchase";
    case "daily_floor": return "Daily top-up";
    default: return type.replace(/_/g, " ");
  }
}

type StatusTone = "paid" | "pending" | "failed" | "info" | "spend";

function statusFor(row: PurchaseRow): { label: string; tone: StatusTone } {
  if (row.type === "refund") return { label: "Refunded", tone: "info" };
  if (row.type === "admin_deduct" || row.type === "boss_burn" || row.type === "boss_reclaim") {
    return { label: "Reversed", tone: "failed" };
  }
  if (row.amount < 0) return { label: "Spent", tone: "spend" };
  if (row.type === "stripe_purchase" || row.type === "vip_purchase") return { label: "Paid", tone: "paid" };
  if (row.amount === 0) return { label: "Recorded", tone: "info" };
  return { label: "Credited", tone: "paid" };
}

const toneClass: Record<StatusTone, string> = {
  paid: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-muted text-muted-foreground border-border",
  spend: "bg-primary/15 text-primary border-primary/30",
};

function parseStripeRef(ref: string | null): { env: "sandbox" | "live"; sessionId: string } | null {
  if (!ref) return null;
  const m = /^stripe:(sandbox|live):(cs_(?:test|live)_[A-Za-z0-9]+)$/.exec(ref);
  if (!m) return null;
  return { env: m[1] as "sandbox" | "live", sessionId: m[2] };
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

export function PurchaseHistory() {
  const fetcher = useServerFn(getCoinPurchaseHistory);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["coin-transactions", "me"],
    queryFn: () => fetcher(),
    staleTime: 30_000,
  });

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

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-destructive">Couldn't load your history.</p>
      ) : (() => {
        const paidCoinPurchases = (data ?? []).filter(
          (row) => row.type === "stripe_purchase" && row.amount > 0,
        );
        if (paidCoinPurchases.length === 0) {
          return (
            <p className="mt-6 text-sm text-muted-foreground">
              No coin purchases yet. Paid top-ups will appear here.
            </p>
          );
        }
        return (
          <ul className="mt-4 divide-y divide-border">
            {paidCoinPurchases.map((row) => {
              const status = statusFor(row);
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{labelForType(row.type)}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneClass[status.tone]}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(row.created_at)}</span>
                      <ReceiptLink row={row} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 font-bold tabular-nums text-emerald-500">
                    +{row.amount}
                    <Coins className="h-4 w-4 text-coin" />
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
