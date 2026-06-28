import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Coins, Crown, Loader2, Receipt } from "lucide-react";
import { useState } from "react";
import { getAllCoinPurchases } from "@/lib/payments.functions";
import { useRole } from "@/hooks/use-role";

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

/**
 * Boss/admin-only collapsible panel listing every coin purchase across all
 * users. Rendered inside the Earnings page; non-privileged users see nothing.
 */
export function AllPurchasesPanel() {
  const { isBoss, isAdmin } = useRole();
  const fetchAll = useServerFn(getAllCoinPurchases);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["admin-all-coin-purchases"],
    queryFn: () => fetchAll(),
    enabled: (isBoss || isAdmin) && open,
    staleTime: 30_000,
  });

  if (!isBoss && !isAdmin) return null;

  const items = q.data?.items ?? [];
  const totals = q.data?.totals ?? {};
  const totalCoins = items.reduce((s, r) => s + r.amount, 0);
  const totalUsers = Object.keys(totals).length;

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Crown className="h-4 w-4 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <div className="text-sm font-bold uppercase tracking-wide text-amber-300">
              Boss view · All purchases
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {q.data
                ? `${items.length} purchases · ${totalUsers} buyers · ${totalCoins.toLocaleString()} coins`
                : "Tap to load every user's purchase history"}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {q.isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading purchases…
            </div>
          )}
          {q.error && (
            <p className="text-xs text-destructive">
              {(q.error as Error).message}
            </p>
          )}
          {!q.isLoading && !q.error && items.length === 0 && (
            <p className="text-xs text-muted-foreground">No purchases yet.</p>
          )}
          {items.length > 0 && (
            <ul className="max-h-96 overflow-y-auto divide-y divide-border/40 rounded-lg border border-border/40 bg-background/40">
              {items.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">
                      {r.display_name ?? r.email ?? r.user_id.slice(0, 8)}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {fmtDate(r.created_at)}
                      {r.email && r.display_name ? ` · ${r.email}` : ""}
                    </div>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-coin/30 bg-coin/10 px-2 py-0.5 font-mono tabular-nums text-coin">
                    <Coins className="h-3 w-3" />
                    +{r.amount.toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
