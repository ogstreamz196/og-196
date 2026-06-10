import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, Check, Sparkles, Loader2, ArrowLeft, Crown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { COIN_PACKS, type CoinPack } from "@/lib/coin-packs";
import { StripeEmbeddedCheckoutInline } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { toast } from "sonner";

const VIP_COST = 20;

export const Route = createFileRoute("/_authenticated/buy-coins")({
  component: BuyCoinsPage,
});

function BuyCoinsPage() {
  const { data: profile } = useProfile();
  const { isVip, refetch: refetchRole } = useRole();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<CoinPack | null>(null);

  const buyVip = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("purchase_vip");
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (newBalance) => {
      toast.success(`Welcome to VIP! 👑 New balance: ${newBalance}`);
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["user-role"] });
      refetchRole();
    },
    onError: (e: Error) => {
      const m = e.message.toLowerCase();
      if (m.includes("insufficient_coins"))
        toast.error(`Not enough coins. You need ${VIP_COST}.`);
      else if (m.includes("already_vip")) toast.error("You're already VIP.");
      else toast.error(e.message);
    },
  });

  if (selected) {
    const returnUrl = `${window.location.origin}/buy-coins/return?session_id={CHECKOUT_SESSION_ID}&pack=${selected.bundleId}`;
    return (
      <DashboardShell title={`Buy ${selected.coins} coins`}>
        <PaymentTestModeBanner />
        <div className="mx-auto max-w-2xl">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Choose a different pack
          </Button>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{selected.label}</div>
                <div className="text-lg font-semibold">
                  {selected.coins} coins · ${(selected.priceCents / 100).toFixed(2)}
                </div>
              </div>
              <Coins className="h-6 w-6 text-coin" />
            </div>
            <StripeEmbeddedCheckoutInline
              priceId={selected.priceId}
              returnUrl={returnUrl}
            />
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Buy Coins">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5">
            <Coins className="h-4 w-4 text-coin" />
            <span className="text-sm">
              You have <span className="font-bold tabular-nums">{profile?.coin_balance ?? 0}</span> coins
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-bold">Top up your coins</h2>
          <p className="mt-2 text-muted-foreground">3 coins per song. Coins never expire.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COIN_PACKS.map((t) => (
            <div
              key={t.bundleId}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 shadow-card",
                t.popular ? "border-primary shadow-glow" : "border-border",
              )}
            >
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most popular
                </div>
              )}
              <div className="text-sm font-medium text-muted-foreground">{t.label}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">${(t.priceCents / 100).toFixed(0)}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-coin">
                <Coins className="h-4 w-4" /> {t.coins} coins
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {t.description}</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Free downloads</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Coins never expire</li>
              </ul>
              <Button
                className={cn(
                  "mt-6 w-full",
                  t.popular && "bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-90",
                )}
                variant={t.popular ? "default" : "outline"}
                onClick={() => setSelected(t)}
              >
                <Sparkles className="mr-2 h-4 w-4" /> Purchase
              </Button>
            </div>
          ))}
        </div>

        {/* VIP — pay with coins */}
        <div className="mt-12">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="text-xl font-bold">Unlock VIP status</h3>
              <p className="text-sm text-muted-foreground">
                Spend coins instead of cash. One-time purchase, never expires.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">Pay with coins</span>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-coin/40 bg-gradient-to-br from-coin/10 via-card to-card p-6 shadow-card">
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-coin/15">
                <Crown className="h-7 w-7 text-coin" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold">VIP Status</h4>
                  {isVip && (
                    <span className="rounded-full bg-coin/15 px-2 py-0.5 text-xs font-medium text-coin">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Show the VIP badge on your profile and unlock priority perks.
                </p>
              </div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Coins className="h-5 w-5 text-coin" />
                <span className="tabular-nums">{VIP_COST}</span>
                <span className="text-sm text-muted-foreground">coins</span>
              </div>
              <Button
                disabled={isVip || buyVip.isPending || (profile?.coin_balance ?? 0) < VIP_COST}
                onClick={() => buyVip.mutate()}
                className="bg-gradient-brand text-primary-foreground"
              >
                {buyVip.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                ) : isVip ? (
                  <>You're VIP</>
                ) : (
                  <><Crown className="mr-2 h-4 w-4" /> Buy VIP for {VIP_COST} coins</>
                )}
              </Button>
            </div>
            {!isVip && (profile?.coin_balance ?? 0) < VIP_COST && (
              <p className="mt-3 text-xs text-destructive">
                You need {VIP_COST - (profile?.coin_balance ?? 0)} more coin(s) — grab a pack above.
              </p>
            )}
          </div>
        </div>


        <p className="mt-8 text-center text-xs text-muted-foreground">
          Secure payments powered by Lovable. Coins are credited to your account automatically after a successful checkout.
        </p>
      </div>
    </DashboardShell>
  );
}
