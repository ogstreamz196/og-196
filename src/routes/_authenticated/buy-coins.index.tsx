import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, Check, ArrowLeft, Crown, Star, Zap, ShieldCheck, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EditableContent } from "@/components/admin/EditableContent";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { COIN_PACKS, CURRENCY_SYMBOL, VIP_PLAN, type CoinPack } from "@/lib/coin-packs";
import { StripeEmbeddedCheckoutInline } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { CirculatingCoins } from "@/components/CirculatingCoins";

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
    const isVipFlow = selected.type === "vip";
    const headline = isVipFlow ? "Join OG VIP" : `Buy ${selected.pack.coins} OG Coins`;
    const totalCents = isVipFlow ? VIP_PLAN.priceCents : selected.pack.priceCents;
    return (
      <DashboardShell title={headline}>
        <PaymentTestModeBanner />
        <div className="mx-auto max-w-2xl">
          <Button variant="ghost" className="mb-4 -ml-2" onClick={() => setSelected(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to coin packs
          </Button>
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-coin/15 via-card to-card px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-coin/20 text-coin shadow-glow">
                  {isVipFlow ? <Crown className="h-5 w-5" /> : <Coins className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Order summary
                  </p>
                  <p className="truncate text-base font-bold">
                    {isVipFlow ? VIP_PLAN.label : `${selected.pack.coins} OG Coins · ${selected.pack.label}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black tabular-nums leading-none">
                  {CURRENCY_SYMBOL}{(totalCents / 100).toFixed(2)}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isVipFlow ? "billed yearly" : "one-time"}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 border-b border-border/60 bg-background/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" /> Secure checkout</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Apple / Google Pay</span>
            </div>
            <div className="p-4 sm:p-5">
              {selected.type === "coins" ? (
                <StripeEmbeddedCheckoutInline priceId={selected.pack.priceId} returnUrl={returnUrl} />
              ) : (
                <StripeEmbeddedCheckoutInline type="vip" returnUrl={returnUrl} />
              )}
            </div>
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
              <h1 className="font-display text-4xl font-black leading-[0.95] tracking-tight text-gradient-brand sm:text-5xl">
                <EditableContent contentKey="buyCoins.heading" defaultValue="Buy OG Coins" />
              </h1>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                <EditableContent
                  contentKey="buyCoins.subtitle"
                  defaultValue="1 OG Coin = 1 message, 1 generation. New users get 5 OG Coins free."
                  multiline
                />
              </p>
            </div>
          </div>
        </section>

        {/* Live coin economy snapshot */}
        <CirculatingCoins />

        {/* Coin packs */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">Coin packs</h2>
            <span className="text-xs font-medium text-muted-foreground">Coins never expire</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(() => {
              const basePerCoin = COIN_PACKS[0]
                ? COIN_PACKS[0].priceCents / 100 / COIN_PACKS[0].coins
                : 0;
              return COIN_PACKS.map((t) => {
                const perCoin = t.priceCents / 100 / t.coins;
                const savingsPct = basePerCoin > 0
                  ? Math.round((1 - perCoin / basePerCoin) * 100)
                  : 0;
                return (
                  <button
                    key={t.bundleId}
                    type="button"
                    onClick={() => setSelected({ type: "coins", pack: t })}
                    aria-label={`Buy ${t.coins} OG Coins for ${CURRENCY_SYMBOL}${(t.priceCents / 100).toFixed(2)}`}
                    className={cn(
                      "group relative flex flex-col rounded-2xl border bg-card p-6 text-left shadow-card transition-all",
                      "hover:-translate-y-1 hover:shadow-glow",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "active:translate-y-0",
                      t.popular ? "border-primary shadow-glow" : "border-border hover:border-primary/40",
                    )}
                  >
                    {t.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow">
                        <Sparkles className="h-3 w-3" /> Best value
                      </div>
                    )}
                    {savingsPct > 0 && (
                      <div className="absolute right-4 top-4 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30">
                        Save {savingsPct}%
                      </div>
                    )}
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t.label}
                    </div>
                    {/* Big OG Coins front and centre */}
                    <div className="mt-3 flex items-center gap-2.5">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-coin/15 transition-transform group-hover:scale-110 group-hover:rotate-[-6deg]">
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
                    <div
                      className={cn(
                        "mt-6 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-bold transition-all",
                        t.popular
                          ? "bg-gradient-brand text-primary-foreground shadow-glow group-hover:opacity-90"
                          : "border border-border bg-background/50 text-foreground group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground",
                      )}
                    >
                      <Coins className="mr-2 h-4 w-4" /> Buy {t.coins} OG Coins
                    </div>
                  </button>
                );
              });
            })()}
          </div>
          <p className="mt-3 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Lock className="h-3 w-3" /> Secure checkout · Apple Pay · Google Pay · Card
          </p>
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
          <div className="relative overflow-hidden rounded-2xl border border-coin/40 bg-gradient-to-br from-coin/10 via-card to-card p-5 shadow-card sm:p-6">
            <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-coin/15 shadow-glow">
                <Crown className="h-7 w-7 text-coin" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">OG VIP</h3>
                  {isVip && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30">
                      Active
                    </span>
                  )}
                </div>
                <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                  <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 shrink-0 text-coin" /> Priority OG Messenger replies</li>
                  <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 shrink-0 text-coin" /> VIP badge across the hub</li>
                  <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 shrink-0 text-coin" /> Early access to new portals</li>
                  <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 shrink-0 text-coin" /> Bonus monthly OG Coin drops</li>
                </ul>
              </div>
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                <div className="text-2xl font-black tabular-nums leading-none">
                  {CURRENCY_SYMBOL}
                  {(VIP_PLAN.priceCents / 100).toFixed(0)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/ year</span>
                </div>
                <Button
                  size="lg"
                  disabled={isVip}
                  onClick={() => setSelected({ type: "vip" })}
                  className="bg-gradient-brand font-bold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0"
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
