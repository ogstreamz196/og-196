import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Coins, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useQueryClient } from "@tanstack/react-query";

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
            <h2 className="mt-4 text-2xl font-bold">Payment complete</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Coins are credited automatically — usually within a few seconds.
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
            <h2 className="text-2xl font-bold">No session found</h2>
            <p className="mt-2 text-sm text-muted-foreground">We couldn't find your checkout session.</p>
            <Button asChild className="mt-6">
              <Link to="/buy-coins">Back to Buy Coins</Link>
            </Button>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
