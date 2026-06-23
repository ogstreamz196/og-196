import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Loader2, Receipt } from "lucide-react";
import { getCoinPurchaseHistory } from "@/lib/payments.functions";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function labelForType(type: string) {
  switch (type) {
    case "stripe_purchase": return "Coin purchase";
    case "referral_bonus": return "Referral bonus";
    case "admin_grant": return "Admin grant";
    case "song_spend": return "Song generation";
    case "song_refund": return "Refund";
    default: return type.replace(/_/g, " ");
  }
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
      ) : !data || data.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No coin activity yet. Your purchases will appear here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {data.map((row) => {
            const positive = row.amount >= 0;
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{labelForType(row.type)}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatDate(row.created_at)}</p>
                </div>
                <div className={`flex shrink-0 items-center gap-1 font-bold tabular-nums ${positive ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {positive ? "+" : ""}{row.amount}
                  <Coins className="h-4 w-4 text-coin" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
