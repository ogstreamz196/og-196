import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, Check, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { COIN_PACKS, type CoinPack } from "@/lib/coin-packs";
import { StripeEmbeddedCheckoutInline } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/_authenticated/buy-coins")({
  component: BuyCoinsPage,
});

function BuyCoinsPage() {
  const { data: profile } = useProfile();
  const [selected, setSelected] = useState<CoinPack | null>(null);

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

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Secure payments powered by Lovable. Coins are credited to your account automatically after a successful checkout.
        </p>
      </div>
    </DashboardShell>
  );
}
