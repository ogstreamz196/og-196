import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Coins, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useQueryClient } from "@tanstack/react-query";
import { EditableContent } from "@/components/admin/EditableContent";

export const Route = createFileRoute("/_authenticated/buy-coins/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string; pack?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
    pack: typeof search.pack === "string" ? search.pack : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [waited, setWaited] = useState(0);

  // Webhooks credit coins asynchronously — poll the profile a few times.
  useEffect(() => {
    if (!session_id) return;
    try { sessionStorage.removeItem("buyCoins.lastSelection"); } catch { /* ignore */ }
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setWaited((w) => w + 1);
    }, 1500);
    const stop = setTimeout(() => clearInterval(id), 20000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [session_id, qc]);

  return (
    <DashboardShell title="Thanks for your purchase">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        {session_id ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-4 text-2xl font-bold">
              <EditableContent contentKey="buyCoins.return.heading" defaultValue="Payment complete" />
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <EditableContent
                contentKey="buyCoins.return.subtitle"
                defaultValue="OG coins are credited automatically — usually within a few seconds."
                multiline
              />
            </p>
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
              <Coins className="h-4 w-4 text-coin" />
              <span className="font-semibold tabular-nums">{profile?.coin_balance ?? 0}</span>
              <span className="text-sm text-muted-foreground">current balance</span>
              {waited > 0 && waited < 12 && (
                <Loader2 className="ml-2 h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="mt-6 flex justify-center gap-2">
              <Button asChild>
                <Link to="/">Back to dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/buy-coins">Buy more</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold">
              <EditableContent contentKey="buyCoins.return.missing.heading" defaultValue="No session found" />
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <EditableContent
                contentKey="buyCoins.return.missing.subtitle"
                defaultValue="We couldn't find your checkout session."
                multiline
              />
            </p>
            <Button asChild className="mt-6">
              <Link to="/buy-coins">Back to Buy Coins</Link>
            </Button>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
