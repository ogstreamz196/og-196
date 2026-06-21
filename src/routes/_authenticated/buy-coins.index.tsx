import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, Check, Sparkles, ArrowLeft, Crown, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EditableContent } from "@/components/admin/EditableContent";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { COIN_PACKS, CURRENCY_SYMBOL, VIP_PLAN, type CoinPack } from "@/lib/coin-packs";
import { StripeEmbeddedCheckoutInline } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

type Selection =
  | { type: "coins"; pack: CoinPack }
  | { type: "vip" };

export const Route = createFileRoute("/_authenticated/buy-coins/")({
  component: BuyCoinsPage,
});

function BuyCoinsPage() {
  const { data: profile } = useProfile();
  const { isVip } = useRole();
  const [selected, setSelected] = useState<Selection | null>(null);

  if (selected) {
    const returnUrl =
      selected.type === "coins"
        ? `${window.location.origin}/buy-coins/return?session_id={CHECKOUT_SESSION_ID}&pack=${selected.pack.bundleId}`
        : `${window.location.origin}/buy-coins/return?session_id={CHECKOUT_SESSION_ID}&pack=${VIP_PLAN.bundleId}`;
    return (
      <DashboardShell title={selected.type === "vip" ? "Join OG VIP" : `Buy ${selected.pack.coins} OG Coins`}>
        <PaymentTestModeBanner />
        <div className="mx-auto max-w-2xl">
          <Button variant="ghost" className="mb-4" onClick={() => setSelected(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to coin packs
          </Button>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              {selected.type === "coins" ? (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground">{selected.pack.label}</div>
                    <div className="text-lg font-semibold">
                      {selected.pack.coins} OG Coins · {CURRENCY_SYMBOL}
                      {(selected.pack.priceCents / 100).toFixed(2)}
                    </div>
                  </div>
                  <Coins className="h-6 w-6 text-coin" />
                </>
              ) : (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground">{VIP_PLAN.label}</div>
                    <div className="text-lg font-semibold">
                      {CURRENCY_SYMBOL}
                      {(VIP_PLAN.priceCents / 100).toFixed(2)} / year
                    </div>
                  </div>
                  <Crown className="h-6 w-6 text-coin" />
                </>
              )}
            </div>
            {selected.type === "coins" ? (
              <StripeEmbeddedCheckoutInline priceId={selected.pack.priceId} returnUrl={returnUrl} />
            ) : (
              <StripeEmbeddedCheckoutInline type="vip" returnUrl={returnUrl} />
            )}
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="OG Coins Store">
      <PaymentTestModeBanner />
      <div className="mx-auto w-full max-w-5xl space-y-8">
        {/* Hero: balance + clear "Buy OG Coins" headline */}
        <section className="relative overflow-hidden rounded-3xl border border-coin/40 bg-gradient-to-br from-coin/20 via-card to-card p-6 shadow-card sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-coin/30 blur-3xl" />
          <div className="relative grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-coin/25 shadow-glow sm:h-20 sm:w-20">
                <Coins className="h-9 w-9 text-coin sm:h-10 sm:w-10" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Your balance
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-5xl font-black tabular-nums leading-none text-foreground sm:text-6xl">
                    {profile?.coin_balance ?? 0}
                  </span>
                  <span className="text-base font-bold text-coin sm:text-lg">OG Coins</span>
                </div>
              </div>
            </div>
            <div className="sm:text-right">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                <EditableContent contentKey="buyCoins.heading" defaultValue="Buy OG Coins" />
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                <EditableContent
                  contentKey="buyCoins.subtitle"
                  defaultValue="1 OG Coin = 1 message, 1 generation. New users get 5 OG Coins free."
                  multiline
                />
              </p>
            </div>
          </div>
        </section>

        {/* Coin packs */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">Coin packs</h2>
            <span className="text-xs font-medium text-muted-foreground">Coins never expire</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {COIN_PACKS.map((t) => {
              const perCoin = t.priceCents / 100 / t.coins;
              return (
                <div
                  key={t.bundleId}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-glow",
                    t.popular ? "border-primary shadow-glow" : "border-border",
                  )}
                >
                  {t.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow">
                      ⭐ Best value
                    </div>
                  )}
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t.label}
                  </div>
                  {/* Big OG Coins front and centre */}
                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-coin/15">
                      <Coins className="h-6 w-6 text-coin" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5 leading-none">
                        <span className="text-4xl font-black tabular-nums text-foreground">{t.coins}</span>
                        <span className="text-sm font-bold text-coin">OG Coins</span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {CURRENCY_SYMBOL}
                        {perCoin.toFixed(2)} per coin
                      </div>
                    </div>
                  </div>
                  {/* Price */}
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-3xl font-black tracking-tight">
                      {CURRENCY_SYMBOL}
                      {(t.priceCents / 100).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">one-time</span>
                  </div>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {t.description}
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Works across Music Hub &amp; OG Messenger
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Instant top-up, never expire
                    </li>
                  </ul>
                  <Button
                    size="lg"
                    className={cn(
                      "mt-6 w-full font-bold",
                      t.popular && "bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-90",
                    )}
                    variant={t.popular ? "default" : "outline"}
                    onClick={() => setSelected({ type: "coins", pack: t })}
                  >
                    <Coins className="mr-2 h-4 w-4" /> Buy {t.coins} OG Coins
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* VIP yearly subscription */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">
              <EditableContent contentKey="buyCoins.vip.heading" defaultValue="OG VIP — Yearly Membership" />
            </h2>
            <p className="text-sm text-muted-foreground">
              <EditableContent
                contentKey="buyCoins.vip.subtitle"
                defaultValue="Unlock exclusive privileges across OG Streamz for a full year."
                multiline
              />
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-coin/40 bg-gradient-to-br from-coin/10 via-card to-card p-6 shadow-card">
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-coin/15">
                <Crown className="h-7 w-7 text-coin" />
              </div>
              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">OG VIP</h3>
                  {isVip && (
                    <span className="rounded-full bg-coin/15 px-2 py-0.5 text-xs font-medium text-coin">
                      Active
                    </span>
                  )}
                </div>
                <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 text-coin" /> Priority OG Messenger replies</li>
                  <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 text-coin" /> VIP badge across the hub</li>
                  <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 text-coin" /> Early access to new portals</li>
                  <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-coin" /> Bonus monthly OG Coin drops</li>
                </ul>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black tabular-nums">
                  {CURRENCY_SYMBOL}
                  {(VIP_PLAN.priceCents / 100).toFixed(0)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/ year</span>
                </div>
                <Button
                  disabled={isVip}
                  onClick={() => setSelected({ type: "vip" })}
                  className="mt-2 bg-gradient-brand font-bold text-primary-foreground"
                >
                  {isVip ? "You're VIP" : (
                    <><Crown className="mr-2 h-4 w-4" /> Join VIP</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          <EditableContent
            contentKey="buyCoins.footer"
            defaultValue="Secure checkout. OG Coins land in your balance the moment payment clears — VIP unlocks instantly too."
            multiline
          />
        </p>
      </div>
    </DashboardShell>
  );
}
