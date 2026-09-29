import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getDailyDropStatus, claimDailyDrop } from "@/lib/daily-drop.functions";
import { cn } from "@/lib/utils";

/** mm:ss style countdown to the next drop. */
function useCountdown(target: string | undefined) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const ms = new Date(target).getTime() - Date.now();
      if (ms <= 0) {
        setLabel("ready");
        return;
      }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(`${h}h ${m}m`);
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [target]);
  return label;
}

/**
 * Daily free coin drop — one claim per person per day (UTC reset).
 * Coins are issued by a server-only atomic routine, never by the browser.
 */
export function DailyDrop({ className }: { className?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const status = useServerFn(getDailyDropStatus);
  const claim = useServerFn(claimDailyDrop);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["daily-drop", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: () => status(),
  });

  const countdown = useCountdown(data?.nextClaimAt);

  async function onClaim() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await claim();
      if (res.claimed) {
        setWon(res.coins);
        toast.success(`Daily drop: +${res.coins} OG coin${res.coins === 1 ? "" : "s"}!`);
      } else {
        toast.info("You've already grabbed today's drop — come back tomorrow.");
      }
      await qc.invalidateQueries({ queryKey: ["daily-drop", user?.id] });
      await qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not claim the daily drop");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  const available = !!data?.available;

  return (
    <Card
      className={cn(
        "border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card shadow-glow",
        className,
      )}
    >
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <div
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/20 text-primary",
            available && "animate-pulse",
          )}
        >
          <Gift className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-black uppercase tracking-[0.14em]">Daily drop</p>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? "Checking your drop…"
              : available
                ? "1–3 free OG coins, once a day. Tap to open."
                : won !== null
                  ? `You bagged ${won} coin${won === 1 ? "" : "s"}. Next drop in ${countdown}.`
                  : `Already claimed. Next drop in ${countdown}.`}
          </p>
        </div>
        <Button
          type="button"
          onClick={onClaim}
          disabled={!available || busy || isLoading}
          className="shrink-0 font-black uppercase tracking-[0.1em]"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : available ? "Claim" : "Claimed"}
        </Button>
      </CardContent>
    </Card>
  );
}
