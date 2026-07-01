import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Coins, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
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

type SyncState = "idle" | "syncing" | "done" | "pending" | "error";

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, refetch: refetchProfile } = useProfile();
  const reconcile = useServerFn(reconcileCoinSession);

  // Push a fresh coin_balance into every cached profile query (any user id
  // variant) so the sidebar HUD, dashboard wallet and other consumers
  // re-render instantly — without waiting for the next refetch round-trip.
  const applyBalance = (balance: number) => {
    qc.setQueriesData<Record<string, unknown> | null | undefined>(
      { queryKey: ["profile"] },
      (prev) => (prev ? { ...prev, coin_balance: balance } : prev),
    );
    if (user?.id) {
      qc.setQueryData<Record<string, unknown> | null | undefined>(
        ["profile", user.id],
        (prev) => (prev ? { ...prev, coin_balance: balance } : prev),
      );
    }
  };
  const [state, setState] = useState<SyncState>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [coinsAdded, setCoinsAdded] = useState<number | null>(null);
  const [confirmedBalance, setConfirmedBalance] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

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
            setCoinsAdded(res.coins);
            setConfirmedBalance(res.balance);
            applyBalance(res.balance);
            qc.invalidateQueries({ queryKey: ["profile"] });
            qc.invalidateQueries({ queryKey: ["coin-transactions"] });
            await refetchProfile();
            toast.success(`+${res.coins} OG coins added`, { description: `Order ${session_id}` });
            setState("done");
            return;
          }
          if (res.status === "already_credited" || res.status === "vip_granted") {
            if (res.status === "already_credited") {
              setCoinsAdded(res.coins);
              setConfirmedBalance(res.balance);
              applyBalance(res.balance);
            }
            qc.invalidateQueries({ queryKey: ["profile"] });
            qc.invalidateQueries({ queryKey: ["coin-transactions"] });
            await refetchProfile();
            setState("done");
            return;
          }
        } catch (e) {
          setErrMsg(e instanceof Error ? e.message : "Network error");
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setState((s) => (s === "done" ? s : "pending"));
    }
    run();
    return () => { cancelled = true; };
  }, [session_id, qc, reconcile, refetchProfile]);

  // Realtime + polling fallback: watch the user's profile row for a coin_balance
  // bump directly from the Stripe webhook, so the HUD updates even if reconcile
  // is still churning. Bails out as soon as we detect an increase or after 45s.
  useEffect(() => {
    if (!session_id || !user?.id) return;
    const baseline = profile?.coin_balance ?? 0;
    let cancelled = false;

    const handleBump = (nextBalance: number) => {
      if (cancelled || nextBalance <= baseline) return;
      applyBalance(nextBalance);
      setConfirmedBalance((prev) => prev ?? nextBalance);
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["coin-transactions"] });
    };

    const channel = supabase
      .channel(`buy-coins-return:${user.id}:${session_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const nextBalance = Number((payload.new as { coin_balance?: number } | null)?.coin_balance ?? 0);
          handleBump(nextBalance);
        },
      )
      .subscribe();

    const pollId = window.setInterval(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("coin_balance")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.coin_balance != null) handleBump(Number(data.coin_balance));
    }, 2500);

    const stopId = window.setTimeout(() => {
      window.clearInterval(pollId);
    }, 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.clearTimeout(stopId);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id, user?.id]);


  // Auto-close on success after a short celebratory beat
  useEffect(() => {
    if (state !== "done") return;
    const id = window.setTimeout(() => {
      setOpen(false);
    }, 2400);
    return () => window.clearTimeout(id);
  }, [state]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Always refresh on close so balance shown elsewhere is fresh.
      qc.invalidateQueries({ queryKey: ["profile"] });
      navigate({ to: "/buy-coins", search: {} });
    }
  }

  async function retry() {
    if (!session_id) return;
    try {
      const env = getStripeEnvironment();
      setState("syncing");
      const res = await reconcile({ data: { sessionId: session_id, environment: env } });
      if ("error" in res) { setErrMsg(res.error); setState("error"); return; }
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["coin-transactions"] });
      if (res.status === "credited") {
        setCoinsAdded(res.coins);
        setConfirmedBalance(res.balance);
        applyBalance(res.balance);
        toast.success(`+${res.coins} OG coins added`);
        setState("done");
      } else {
        if (res.status === "already_credited") {
          setCoinsAdded(res.coins);
          setConfirmedBalance(res.balance);
          applyBalance(res.balance);
        }
        setState(res.status === "pending" ? "pending" : "done");
      }
      await refetchProfile();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Retry failed");
      setState("error");
    }
  }

  return (
    <DashboardShell title="Thanks for your purchase">
      <Dialog open={open && !!session_id} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-primary/10">
              {state === "error" ? (
                <AlertTriangle className="h-7 w-7 text-destructive" />
              ) : state === "done" ? (
                <CheckCircle2 className="h-7 w-7 text-primary" />
              ) : (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              )}
            </div>
            <DialogTitle className="text-center text-2xl">
              {state === "done" && "Purchase complete"}
              {state === "syncing" && "Crediting your coins…"}
              {state === "pending" && "Awaiting confirmation"}
              {state === "error" && "Couldn't credit coins"}
              {state === "idle" && "Processing…"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {state === "done" && coinsAdded != null && (
                <span className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-coin" />
                  +{coinsAdded} OG coins added to your wallet
                </span>
              )}
              {state === "done" && coinsAdded == null && "Your OG coins are ready to spend."}
              {state === "syncing" && "Hang tight — we're syncing your payment with Stripe."}
              {state === "pending" && "Stripe hasn't confirmed payment yet. Try again in a moment."}
              {state === "error" && (errMsg ?? "Something went wrong crediting your coins.")}
            </DialogDescription>
            {session_id && (
              <div className="mt-2 text-center text-[11px] text-muted-foreground">
                Order ref:{" "}
                <code className="select-all rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
                  {session_id}
                </code>
              </div>
            )}
          </DialogHeader>

          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
            <Coins className="h-4 w-4 text-coin" />
            <span className="font-bold tabular-nums">{confirmedBalance ?? profile?.coin_balance ?? 0}</span>
            <span className="text-sm text-muted-foreground">current balance</span>
            {state === "syncing" && (
              <Loader2 className="ml-1 h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>

          <DialogFooter className="sm:justify-center">
            {(state === "pending" || state === "error") && (
              <Button variant="secondary" onClick={retry}>Retry</Button>
            )}
            <Button onClick={() => handleOpenChange(false)}>
              {state === "done" ? "Awesome, close" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!session_id && (
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <h2 className="text-2xl font-bold">No session found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't find your checkout session.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/buy-coins", search: {} })}>
            Back to Buy Coins
          </Button>
        </div>
      )}

      <PurchaseHistory />
    </DashboardShell>
  );
}
