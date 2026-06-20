import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, Check, Sparkles, ArrowLeft, Crown, Star } from "lucide-react";
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
      <DashboardShell title={selected.type === "vip" ? "Join OG VIP" : `Buy ${selected.pack.coins} OG coins`}>
        <PaymentTestModeBanner />
        <div className="mx-auto max-w-2xl">
          <Button variant="ghost" className="mb-4" onClick={() => setSelected(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to plans
          </Button>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              {selected.type === "coins" ? (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground">{selected.pack.label}</div>
                    <div className="text-lg font-semibold">
                      {selected.pack.coins} OG coins · {CURRENCY_SYMBOL}
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
    <DashboardShell title="Top up OG Coins">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5">
            <Coins className="h-4 w-4 text-coin" />
            <span className="text-sm">
              You have <span className="font-bold tabular-nums">{profile?.coin_balance ?? 0}</span> OG coins
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-bold">
            <EditableContent contentKey="buyCoins.heading" defaultValue="Fuel your OG Bot" />
          </h2>
          <p className="mt-2 text-muted-foreground">
            <EditableContent
              contentKey="buyCoins.subtitle"
              defaultValue="Every signed-in user gets 5 free credits. Each OG Messenger message costs 1 credit."
              multiline
            />
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
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
                  Best value
                </div>
              )}
              <div className="text-sm font-medium text-muted-foreground">{t.label}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  {CURRENCY_SYMBOL}
                  {(t.priceCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-coin">
                <Coins className="h-4 w-4" /> {t.coins} OG coins
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {t.description}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> Works across Music Hub & OG Messenger
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> Coins never expire
                </li>
              </ul>
              <Button
                className={cn(
                  "mt-6 w-full",
                  t.popular && "bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-90",
                )}
                variant={t.popular ? "default" : "outline"}
                onClick={() => setSelected({ type: "coins", pack: t })}
              >
                <Sparkles className="mr-2 h-4 w-4" /> Buy now
              </Button>
            </div>
          ))}
        </div>

        {/* VIP yearly subscription */}
        <div className="mt-12">
          <div className="mb-4">
            <h3 className="text-xl font-bold">
              <EditableContent contentKey="buyCoins.vip.heading" defaultValue="OG VIP — Yearly Membership" />
            </h3>
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
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold">OG VIP</h4>
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
                  <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 text-coin" /> Bonus monthly credit drops</li>
                </ul>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {CURRENCY_SYMBOL}
                  {(VIP_PLAN.priceCents / 100).toFixed(0)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/ year</span>
                </div>
                <Button
                  disabled={isVip}
                  onClick={() => setSelected({ type: "vip" })}
                  className="mt-2 bg-gradient-brand text-primary-foreground"
                >
                  {isVip ? "You're VIP" : (
                    <><Crown className="mr-2 h-4 w-4" /> Join VIP</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <EditableContent
            contentKey="buyCoins.footer"
            defaultValue="Secure payments. OG coins are credited automatically and VIP unlocks the moment checkout completes."
            multiline
          />
        </p>
      </div>
    </DashboardShell>
  );
}
