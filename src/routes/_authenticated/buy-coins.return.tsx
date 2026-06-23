import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Coins, Loader2, AlertTriangle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useQueryClient } from "@tanstack/react-query";
import { EditableContent } from "@/components/admin/EditableContent";
import { PurchaseHistory } from "@/components/PurchaseHistory";
import { reconcileCoinSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";

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
  const reconcile = useServerFn(reconcileCoinSession);
  const [state, setState] = useState<"idle" | "syncing" | "done" | "pending" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Webhooks should credit coins, but they can be delayed or fail.
  // Self-heal: call reconcileCoinSession from the return page so a paid
  // session always credits the user, even if the webhook never arrives.
  useEffect(() => {
    if (!session_id) return;
    try { sessionStorage.removeItem("buyCoins.lastSelection"); } catch { /* ignore */ }
    let cancelled = false;
    let attempts = 0;

    async function run() {
      setState("syncing");
      let env: ReturnType<typeof getStripeEnvironment>;
      try { env = getStripeEnvironment(); } catch (e) {
        setErrMsg(e instanceof Error ? e.message : "Stripe not configured");
        setState("error");
        return;
      }
      while (!cancelled && attempts < 8) {
        attempts++;
        try {
          const res = await reconcile({ data: { sessionId: session_id!, environment: env } });
          if (cancelled) return;
          if ("error" in res) {
            setErrMsg(res.error);
            setState("error");
            return;
          }
          if (res.status === "credited") {
            qc.invalidateQueries({ queryKey: ["profile"] });
            qc.invalidateQueries({ queryKey: ["coin-transactions"] });
            toast.success(`Credited ${res.coins} OG coins`);
            setState("done");
            return;
          }
          if (res.status === "already_credited" || res.status === "vip_granted") {
            qc.invalidateQueries({ queryKey: ["profile"] });
            qc.invalidateQueries({ queryKey: ["coin-transactions"] });
            setState("done");
            return;
          }
          // pending — wait and retry
        } catch (e) {
          setErrMsg(e instanceof Error ? e.message : "Network error");
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setState((s) => (s === "done" ? s : "pending"));
    }
    run();
    return () => { cancelled = true; };
  }, [session_id, qc, reconcile]);

  async function retry() {
    if (!session_id) return;
    try {
      const env = getStripeEnvironment();
      setState("syncing");
      const res = await reconcile({ data: { sessionId: session_id, environment: env } });
      if ("error" in res) { setErrMsg(res.error); setState("error"); return; }
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["coin-transactions"] });
      setState(res.status === "pending" ? "pending" : "done");
      if (res.status === "credited") toast.success(`Credited ${res.coins} OG coins`);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Retry failed");
      setState("error");
    }
  }

  return (
    <DashboardShell title="Thanks for your purchase">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        {session_id ? (
          <>
            {state === "error" ? (
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            ) : (
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            )}
            <h2 className="mt-4 text-2xl font-bold">
              <EditableContent contentKey="buyCoins.return.heading" defaultValue="Payment complete" />
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {state === "syncing" && "Crediting your OG coins…"}
              {state === "done" && (
                <EditableContent
                  contentKey="buyCoins.return.subtitle"
                  defaultValue="OG coins are credited and ready to spend."
                  multiline
                />
              )}
              {state === "pending" && "Stripe hasn't confirmed payment yet. Tap retry in a moment."}
              {state === "error" && (errMsg ?? "Something went wrong crediting your coins.")}
            </p>
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
              <Coins className="h-4 w-4 text-coin" />
              <span className="font-semibold tabular-nums">{profile?.coin_balance ?? 0}</span>
              <span className="text-sm text-muted-foreground">current balance</span>
              {state === "syncing" && (
                <Loader2 className="ml-2 h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/">Back to dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/buy-coins">Buy more</Link>
              </Button>
              {(state === "pending" || state === "error") && (
                <Button variant="secondary" onClick={retry}>Retry crediting</Button>
              )}
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

      <PurchaseHistory />
    </DashboardShell>
  );
}
