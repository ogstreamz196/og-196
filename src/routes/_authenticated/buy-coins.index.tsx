import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, Check, ArrowLeft, Crown, Star, Zap, ShieldCheck, Lock, Sparkles, Infinity as InfinityIcon, TrendingDown, Gift, Pencil, X, Loader2, CreditCard, Plus, Minus, SlidersHorizontal, Store, Tag, ToggleLeft, ToggleRight, Gem, Trophy, Flame, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EditableContent } from "@/components/admin/EditableContent";
import { useAdminEditMode, AdminEditModeToggle } from "@/components/admin/AdminEditMode";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { useSiteContent, useSetSiteContent } from "@/hooks/use-site-content";
import { cn } from "@/lib/utils";
import {
  COIN_PACKS, CURRENCY_SYMBOL, VIP_PLAN, CUSTOM_COIN_UNIT,
  applyPackOverride, parsePackOverride, packOverrideKey, packShowsBonus,
  type CoinPack, type PackOverride,
} from "@/lib/coin-packs";
import {
  loadStoredSelection,
  persistSelection,
  clearStoredSelection,
  type Selection,
} from "@/lib/buy-coins-selection";
import { StripeEmbeddedCheckoutInline } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

import { toast } from "sonner";
import { PurchaseHistory } from "@/components/PurchaseHistory";
import { ReferralReminder } from "@/components/referrals/ReferralReminder";

export const Route = createFileRoute("/_authenticated/buy-coins/")({
  validateSearch: (s: Record<string, unknown>) => ({
    edit: s.edit === "1" || s.edit === 1 || s.edit === true ? 1 : undefined,
  }),
  component: BuyCoinsPage,
});

function BuyCoinsPage() {
  const { data: profile } = useProfile();
  const { isVip, isDev, isLoading: roleLoading } = useRole();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [stage, setStage] = useState<"confirm" | "pay">("confirm");

  // Friendly bounce if a non-dev/admin opens the page in edit mode
  // (e.g. shared `?edit=1` link). The actual edit gate is enforced
  // server-side and in <AdminEditModeProvider>; this just gives the
  // user a clear message instead of a silently inert UI.
  useEffect(() => {
    if (search.edit !== 1) return;
    if (roleLoading) return; // wait for role resolution before deciding
    if (isDev) return; // dev/admin: leave them in edit mode
    toast.info("Edit mode is for the OG Studio team only — showing you the normal store view.", {
      duration: 4500,
    });
    navigate({ to: "/buy-coins", search: {}, replace: true });
  }, [search.edit, isDev, roleLoading, navigate]);



  // Restore previous selection (e.g. after a canceled Stripe checkout).
  useEffect(() => {
    if (selected) return;
    const restored = loadStoredSelection();
    if (!restored) return;
    setSelected(restored);
    setStage("confirm");
    toast.info("We brought you back to your last selection.");
  }, [selected]);

  const pickSelection = (s: Selection) => {
    persistSelection(s);
    setSelected(s);
    setStage("confirm");
  };

  const clearSelection = () => {
    clearStoredSelection();
    setSelected(null);
    setStage("confirm");
  };


  // Anchor savings calc against the worst per-coin price (the smallest pack).
  const basePerCoin = COIN_PACKS.reduce(
    (max, p) => Math.max(max, p.priceCents / 100 / p.coins),
    0,
  );

  if (selected) {
    const isVipFlow = selected.type === "vip";
    const isCustomFlow = selected.type === "custom";
    const coinsForOrder = isVipFlow
      ? 0
      : isCustomFlow
      ? selected.units * CUSTOM_COIN_UNIT.coins
      : selected.pack.coins;
    const labelForOrder = isVipFlow
      ? VIP_PLAN.label
      : isCustomFlow
      ? `Custom · ${coinsForOrder} OG Coins`
      : `${selected.pack.coins} OG Coins · ${selected.pack.label}`;
    const totalCents = isVipFlow
      ? VIP_PLAN.priceCents
      : isCustomFlow
      ? selected.units * CUSTOM_COIN_UNIT.priceCents
      : selected.pack.priceCents;
    const returnUrlPack = isVipFlow
      ? VIP_PLAN.bundleId
      : isCustomFlow
      ? "coins_custom"
      : selected.pack.bundleId;
    const returnUrl = `${window.location.origin}/buy-coins/return?session_id={CHECKOUT_SESSION_ID}&pack=${returnUrlPack}`;
    const headline = isVipFlow ? "Join OG VIP" : `Buy ${coinsForOrder} OG Coins`;
    const perCoin = !isVipFlow && coinsForOrder > 0 ? totalCents / 100 / coinsForOrder : 0;
    const savingsPct = !isVipFlow && basePerCoin > 0 && perCoin > 0
      ? Math.round((1 - perCoin / basePerCoin) * 100)
      : 0;

    return (
      <DashboardShell title={headline}>
        <PaymentTestModeBanner />
        <div className="mx-auto max-w-2xl">
          <Button variant="ghost" className="mb-4 -ml-2" onClick={clearSelection}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to coin packs
          </Button>
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-coin/15 via-card to-card px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-coin/20 text-coin shadow-glow">
                  {isVipFlow ? <Crown className="h-5 w-5" /> : <Coins className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Order summary
                  </p>
                  <p className="truncate text-base font-bold">
                    {labelForOrder}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black tabular-nums leading-none sm:text-3xl">
                  {CURRENCY_SYMBOL}{(totalCents / 100).toFixed(2)}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isVipFlow ? "billed yearly" : "one-time"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-border/60 bg-background/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-5 sm:py-2.5">
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" /> Secure checkout</span>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Apple / Google Pay</span>
            </div>
            {stage === "confirm" ? (
              <div className="p-5 sm:p-6">
                {/* Confirmation banner — extra prominent for custom builds */}
                <div
                  role="status"
                  aria-live="polite"
                  className={cn(
                    "relative overflow-hidden rounded-2xl border-2 p-4",
                    isCustomFlow
                      ? "border-red-500/50 bg-gradient-to-br from-[#1a0505] via-[#0b0202] to-[#170303] shadow-[0_0_40px_-10px_rgba(239,68,68,0.6)]"
                      : "border-emerald-500/40 bg-emerald-500/10",
                  )}
                >
                  {isCustomFlow && (
                    <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-red-500/25 blur-3xl animate-pulse" />
                  )}
                  <div className="relative flex items-start gap-3">
                    <div className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      isCustomFlow ? "border border-red-500/50 bg-red-500/15 text-red-300" : "bg-emerald-500/20 text-emerald-300",
                    )}>
                      {isCustomFlow ? <Flame className="h-5 w-5" /> : <Check className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">
                        {isCustomFlow ? "Custom stack locked in" : isVipFlow ? "VIP plan selected" : "Pack selected"}
                      </p>
                      <p className="mt-0.5 truncate font-display text-lg font-black text-white sm:text-xl">
                        {isVipFlow
                          ? VIP_PLAN.label
                          : isCustomFlow
                          ? `${coinsForOrder} OG Coins`
                          : `${(selected as { pack: CoinPack }).pack.coins} OG Coins · ${(selected as { pack: CoinPack }).pack.label}`}
                      </p>
                      {!isVipFlow && (
                        <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-white/60 tabular-nums">
                          {CURRENCY_SYMBOL}{(totalCents / 100).toFixed(2)} · {CURRENCY_SYMBOL}{perCoin.toFixed(3)} per coin
                          {savingsPct > 0 ? ` · save ${savingsPct}%` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Order summary
                </p>
                <div className="mt-2 grid gap-2 rounded-2xl border border-border bg-background/40 p-4 text-sm">
                  <Row
                    label={isVipFlow ? "Plan" : "Pack"}
                    value={isVipFlow ? VIP_PLAN.label : isCustomFlow ? "Custom" : (selected as { pack: CoinPack }).pack.label}
                  />
                  {!isVipFlow && <Row label="Coins" value={`${coinsForOrder} OG Coins`} />}
                  {!isVipFlow && (
                    <Row
                      label="Per coin"
                      value={`${CURRENCY_SYMBOL}${perCoin.toFixed(3)}`}
                      hint={savingsPct > 0 ? `Save ${savingsPct}% vs smallest pack` : undefined}
                    />
                  )}
                  <Row
                    label="Billing"
                    value={isVipFlow ? "Yearly subscription" : "One-time payment"}
                  />
                  <div className="mt-1 flex items-baseline justify-between border-t border-border/60 pt-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total today</span>
                    <span className="text-2xl font-black tabular-nums">
                      {CURRENCY_SYMBOL}{(totalCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Next steps — clear what happens next */}
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  What happens next
                </p>
                <ol className="mt-2 space-y-2">
                  <NextStep n={1} title="Continue to secure checkout" body="Pay with card, Apple Pay, or Google Pay. PCI-compliant via Stripe." />
                  <NextStep
                    n={2}
                    title={isVipFlow ? "VIP unlocks instantly" : "Coins land in your wallet"}
                    body={isVipFlow
                      ? "All VIP perks activate the moment payment confirms."
                      : `${coinsForOrder} OG Coins credited within seconds — no waiting.`}
                  />
                  <NextStep
                    n={3}
                    title={isVipFlow ? "Manage anytime in Settings" : "Start burning coins"}
                    body={isVipFlow
                      ? "Cancel or change plan whenever you like."
                      : "Head to MusicHUB or Messenger and spend when ready. Coins never expire."}
                  />
                </ol>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={clearSelection} className="h-12 sm:h-10">Cancel</Button>
                  <Button
                    onClick={() => setStage("pay")}
                    className="h-12 w-full bg-gradient-brand font-bold text-primary-foreground shadow-glow hover:opacity-90 sm:h-10 sm:w-auto"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Continue · {CURRENCY_SYMBOL}{(totalCents / 100).toFixed(2)}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5">
                {selected.type === "coins" ? (
                  <StripeEmbeddedCheckoutInline priceId={selected.pack.priceId} returnUrl={returnUrl} />
                ) : selected.type === "custom" ? (
                  <StripeEmbeddedCheckoutInline type="custom" customUnits={selected.units} returnUrl={returnUrl} />
                ) : (
                  <StripeEmbeddedCheckoutInline type="vip" returnUrl={returnUrl} />
                )}
                <button
                  type="button"
                  onClick={() => setStage("confirm")}
                  className="mt-3 text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                >
                  ← Change selection
                </button>
              </div>
            )}
          </div>
        </div>
      </DashboardShell>
    );
  }


  return (
    <DashboardShell title="OG Coin Vault">
      <PaymentTestModeBanner />
      {/* Sticky wallet bar — keeps balance in view while scrolling bundles */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-coin/30 bg-background/85 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div
          role="status"
          aria-label={`Wallet balance ${profile?.coin_balance ?? 0} OG coins`}
          className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3"
        >
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-coin">
            <Wallet className="h-3 w-3" /> Wallet
          </span>
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            <Coins className="h-4 w-4 self-center text-coin" />
            <span className="font-black tabular-nums leading-none text-foreground [font-size:clamp(1rem,4vw,1.25rem)]">
              {profile?.coin_balance ?? 0}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              OG&nbsp;coins
            </span>
          </span>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl space-y-8 sm:space-y-12">
        {/* Arcade-style hero */}
        <section className="relative overflow-hidden rounded-3xl border-2 border-coin/40 bg-gradient-to-br from-background via-card to-background shadow-glow">
          {/* scanline + glow fx */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 4px)" }} />
          <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-coin/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -bottom-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />

          <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4 min-w-0">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-coin/40 to-coin/10 text-coin shadow-glow ring-2 ring-coin/40">
                <Coins className="h-7 w-7 drop-shadow" />
              </div>
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-coin/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.25em] text-coin ring-1 ring-coin/40">
                  <Flame className="h-3 w-3" /> The Coin Vault
                </p>
                <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
                  <EditableContent contentKey="buyCoins.heading" defaultValue="Stock up. Power up." />
                </h1>
              </div>
            </div>

            {/* HUD wallet — single line balance */}
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
              <div className="w-full rounded-2xl border-2 border-coin/50 bg-background/60 px-4 py-3 backdrop-blur-md shadow-glow sm:w-auto">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-coin">
                  <Wallet className="h-3 w-3" /> Wallet balance
                </div>
                <div className="mt-1 flex items-baseline gap-2 whitespace-nowrap">
                  <Coins className="h-5 w-5 shrink-0 self-center text-coin" />
                  <span className="font-black tabular-nums leading-none [font-size:clamp(1.5rem,6vw,2rem)]">
                    {profile?.coin_balance ?? 0}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    OG&nbsp;coins
                  </span>
                </div>
              </div>
              <div className="self-end">
                <AdminEditModeToggle />
              </div>
            </div>
          </div>
        </section>

        {/* Your OG sharing code first — earn while others spend */}
        <ReferralReminder />

        {/* Custom pack — build your own stack first */}
        <section aria-labelledby="section-custom">
          <SectionDivider id="section-custom" eyebrow="Step 1" title="Build your custom stack" icon={<SlidersHorizontal className="h-3.5 w-3.5" />} />
          <SectionCard>
            <div className="p-5 sm:p-6">
              <CustomPackCard onBuy={(units) => pickSelection({ type: "custom", units })} />
            </div>
          </SectionCard>
        </section>

        {/* VIP monthly subscription — placed right below custom for max visibility */}
        <section aria-labelledby="section-vip">
          <SectionDivider id="section-vip" eyebrow="Or upgrade" title="Go VIP for the full pass" icon={<Crown className="h-3.5 w-3.5" />} tone="coin" />
          <SectionCard className="border-coin/40">
            <SectionHeader
              eyebrow="Membership Pass"
              title={<EditableContent contentKey="buyCoins.vip.heading" defaultValue="Unlock the OG VIP Pass" />}
              subtitle={<EditableContent contentKey="buyCoins.vip.subtitle" defaultValue="Unlock exclusive privileges across OG Streamz — billed monthly, cancel anytime." multiline />}
              icon={<Crown className="h-5 w-5 text-coin" />}
            />
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="relative grid gap-4 rounded-2xl border border-coin/30 bg-gradient-to-br from-coin/10 via-card to-card p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">OG VIP</h3>
                    {isVip && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30">
                        Active
                      </span>
                    )}
                  </div>
                  <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                    <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 shrink-0 text-coin" /> Foul-mouth OG Bot unlocked</li>
                    <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 shrink-0 text-coin" /> Priority OG Bot replies</li>
                    <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 shrink-0 text-coin" /> VIP badge across the hub</li>
                    <li className="flex items-center gap-2"><Gift className="h-3.5 w-3.5 shrink-0 text-coin" /> Daily 10-coin safety net</li>
                  </ul>
                </div>
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                  <div className="text-right">
                    <div className="text-3xl font-black tabular-nums leading-none">
                      {CURRENCY_SYMBOL}{(VIP_PLAN.priceCents / 100).toFixed(0)}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-muted-foreground">/ month</div>
                  </div>
                  <Button
                    size="lg"
                    disabled={isVip}
                    onClick={() => pickSelection({ type: "vip" })}
                    className="bg-gradient-brand font-bold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0"
                  >
                    {isVip ? "You're VIP" : (<><Crown className="mr-2 h-4 w-4" /> Join VIP</>)}
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>
        </section>

        {/* Coin bundles grid */}
        <section aria-labelledby="section-bundles">
          <SectionDivider
            id="section-bundles"
            eyebrow="Or grab a preset"
            title="Coin bundles"
            icon={<Gem className="h-3.5 w-3.5" />}
            action={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400 ring-1 ring-emerald-500/30">
                <TrendingDown className="h-3 w-3" /> Save up to {Math.round((1 - (COIN_PACKS[COIN_PACKS.length - 1].priceCents / 100 / COIN_PACKS[COIN_PACKS.length - 1].coins) / basePerCoin) * 100)}%
              </span>
            }
          />
          <SectionCard>
            <div className="p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {COIN_PACKS.map((t, i) => (
                  <PackCard
                    key={t.bundleId}
                    pack={t}
                    tierIndex={i}
                    totalTiers={COIN_PACKS.length}
                    basePerCoin={basePerCoin}
                    onBuy={(effective) => pickSelection({ type: "coins", pack: effective })}
                  />
                ))}
              </div>

              <p className="mt-4 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Lock className="h-3 w-3" /> Secure checkout · Apple Pay · Google Pay · Card
              </p>
            </div>
          </SectionCard>
        </section>

        {/* Trust strip */}
        <SectionCard>
          <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
            <TrustItem icon={<ShieldCheck className="h-5 w-5 text-emerald-400" />} title="Secure by Stripe" body="PCI-compliant checkout, your card never touches our servers." />
            <TrustItem icon={<InfinityIcon className="h-5 w-5 text-coin" />} title="Coins never expire" body="Top up once, use whenever — no monthly resets." />
            <TrustItem icon={<Check className="h-5 w-5 text-primary" />} title="Instant credit" body="Coins land in your balance the moment payment clears." />
          </div>
        </SectionCard>


        <p className="text-center text-xs text-muted-foreground">
          <EditableContent
            contentKey="buyCoins.footer"
            defaultValue="Questions? Tap OG Bot and we'll sort it. VAT included where applicable."
            multiline
          />
        </p>
        <PurchaseHistory />
      </div>
    </DashboardShell>
  );
}

// ---------- Reusable section chrome ----------

function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-3xl border border-border bg-card shadow-card", className)}>
      {children}
    </section>
  );
}

function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
      {children}
    </div>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

function SectionHeader({
  icon, eyebrow, title, subtitle, action,
}: {
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-background/30 p-5 sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <SectionIcon>{icon}</SectionIcon> : null}
        <div className="min-w-0">
          {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
          <h2 className="font-display text-lg font-black tracking-tight sm:text-xl">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </div>
  );
}

// ---------- Pack card with per-field admin inline edit ----------

type EditingField = "label" | "description" | "coins" | "price" | null;

const RARITY_TIERS = [
  { name: "Common",    Icon: Coins,  ring: "ring-slate-400/40",   glow: "",                   pill: "bg-slate-500/15 text-slate-300 ring-slate-400/30" },
  { name: "Rare",      Icon: Zap,    ring: "ring-sky-400/50",     glow: "shadow-[0_0_30px_-8px_oklch(0.7_0.18_240)]", pill: "bg-sky-500/15 text-sky-300 ring-sky-400/40" },
  { name: "Epic",      Icon: Gem,    ring: "ring-purple-400/60",  glow: "shadow-[0_0_40px_-10px_oklch(0.7_0.22_300)]", pill: "bg-purple-500/15 text-purple-300 ring-purple-400/40" },
  { name: "Legendary", Icon: Trophy, ring: "ring-coin/70",        glow: "shadow-[0_0_60px_-10px_oklch(0.8_0.18_85)]",  pill: "bg-coin/20 text-coin ring-coin/50" },
  { name: "Mythic",    Icon: Flame,  ring: "ring-red-400/60",     glow: "shadow-[0_0_60px_-10px_oklch(0.7_0.22_25)]",  pill: "bg-red-500/15 text-red-300 ring-red-400/40" },
] as const;

function PackCard({
  pack,
  tierIndex,
  totalTiers,
  basePerCoin,
  onBuy,
}: {
  pack: CoinPack;
  tierIndex: number;
  totalTiers: number;
  basePerCoin: number;
  onBuy: (effective: CoinPack) => void;
}) {
  const { isAdmin } = useRole();
  const { enabled } = useAdminEditMode();
  const { get } = useSiteContent();
  const setMut = useSetSiteContent();
  const canEdit = isAdmin && enabled;

  const raw = get(packOverrideKey(pack.bundleId), "");
  const override = useMemo(() => parsePackOverride(raw), [raw]);

  const effective = applyPackOverride(pack, override);
  const showBonus = packShowsBonus(override);

  const perCoin = effective.priceCents / 100 / effective.coins;
  const savingsPct = basePerCoin > 0 ? Math.round((1 - perCoin / basePerCoin) * 100) : 0;
  const accent = pack.bestValue || pack.popular;
  // Map pack position → rarity tier (last pack always gets the top tier).
  const tierIdx = totalTiers <= 1
    ? 0
    : Math.min(RARITY_TIERS.length - 1, Math.round((tierIndex / (totalTiers - 1)) * (RARITY_TIERS.length - 1)));
  const tier = RARITY_TIERS[tierIdx];
  const TierIcon = tier.Icon;

  const [field, setField] = useState<EditingField>(null);
  const [draft, setDraft] = useState("");

  function startEdit(f: EditingField, currentValue: string) {
    if (!canEdit || !f) return;
    setField(f);
    setDraft(currentValue);
  }

  function persist(next: PackOverride) {
    if (!canEdit) {
      toast.error("Not authorized");
      return;
    }
    setMut.mutate(
      { key: packOverrideKey(pack.bundleId), value: JSON.stringify(next) },
      {
        onSuccess: () => {
          toast.success("Saved — syncs to checkout", { id: "pack-saved" });
          setField(null);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  function commit() {
    const next: PackOverride = { ...override };
    if (field === "label") {
      const v = draft.trim();
      if (!v) return toast.error("Label required");
      next.label = v;
    } else if (field === "description") {
      next.description = draft.trim() || undefined;
    } else if (field === "coins") {
      const n = Math.trunc(Number(draft));
      if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return toast.error("Coins must be 1–1,000,000");
      next.coins = n;
    } else if (field === "price") {
      const pounds = Number(draft);
      if (!Number.isFinite(pounds) || pounds <= 0 || pounds > 10_000) return toast.error("Price must be > 0");
      next.priceCents = Math.round(pounds * 100);
    }
    persist(next);
  }

  function toggleBonus() {
    persist({ ...override, bonus: !showBonus });
  }

  function resetField(f: Exclude<EditingField, null>) {
    const next: PackOverride = { ...override };
    if (f === "label") delete next.label;
    else if (f === "description") delete next.description;
    else if (f === "coins") delete next.coins;
    else if (f === "price") delete next.priceCents;
    persist(next);
  }

  const isOverridden = (f: Exclude<EditingField, null>) => {
    if (f === "label") return override.label !== undefined;
    if (f === "description") return override.description !== undefined;
    if (f === "coins") return override.coins !== undefined;
    if (f === "price") return override.priceCents !== undefined;
    return false;
  };

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border-2 bg-card p-5 transition-all ring-1 hover:-translate-y-0.5",
        tier.ring,
        tier.glow || "shadow-card",
        accent ? "border-coin/60" : "border-border",
        canEdit && "ring-primary/40",
      )}
    >
      {/* Holographic top stripe */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-coin/60 to-transparent opacity-60" />

      {/* Rarity tier pill */}
      <div className={cn(
        "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] ring-1",
        tier.pill,
      )}>
        <TierIcon className="h-3 w-3" /> {tier.name}
      </div>

      {pack.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary-foreground shadow whitespace-nowrap">
          <Sparkles className="h-3 w-3" /> Most popular
        </div>
      )}
      {pack.bestValue && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-coin px-3 py-1 text-[11px] font-black uppercase tracking-wider text-background shadow whitespace-nowrap">
          <Crown className="h-3 w-3" /> Best value
        </div>
      )}
      {savingsPct > 0 && !canEdit && (
        <div className="absolute right-3 top-3 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30">
          −{savingsPct}%
        </div>
      )}

      {/* spacer so the rarity pill doesn't collide with content */}
      <div className="h-6" aria-hidden />


      {/* Label row */}
      <EditableField
        canEdit={canEdit}
        editing={field === "label"}
        overridden={isOverridden("label")}
        onStart={() => startEdit("label", effective.label)}
        onCancel={() => setField(null)}
        onCommit={commit}
        onReset={() => resetField("label")}
        draft={draft}
        setDraft={setDraft}
        inputProps={{ maxLength: 40 }}
        view={
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {effective.label}
          </div>
        }
      />

      {/* Coins + bonus */}
      <div className="mt-3 flex items-center gap-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coin/15">
          <Coins className="h-5 w-5 text-coin" />
        </div>
        <div className="min-w-0 flex-1">
          <EditableField
            canEdit={canEdit}
            editing={field === "coins"}
            overridden={isOverridden("coins")}
            onStart={() => startEdit("coins", String(effective.coins))}
            onCancel={() => setField(null)}
            onCommit={commit}
            onReset={() => resetField("coins")}
            draft={draft}
            setDraft={setDraft}
            inputProps={{ type: "number", min: 1, step: 1 }}
            view={
              <div className="flex items-baseline gap-1.5 whitespace-nowrap leading-none">
                {showBonus && (
                  <span className="text-base font-bold tabular-nums text-muted-foreground/70 line-through decoration-2">
                    {Math.round(effective.coins / 2)}
                  </span>
                )}
                <span className={cn("text-2xl font-black tabular-nums sm:text-3xl", showBonus && "flash-gold")}>
                  {effective.coins}
                </span>
                <span className="text-[11px] font-bold text-coin">Coins</span>
              </div>
            }
          />

          <div className="mt-1 flex items-center gap-2">
            {canEdit ? (
              <button
                type="button"
                onClick={toggleBonus}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition",
                  showBonus
                    ? "bg-coin/15 text-coin hover:bg-coin/25"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
                title="Toggle 2× bonus visual"
              >
                {showBonus ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                {showBonus ? "2× bonus on" : "2× bonus off"}
              </button>
            ) : showBonus ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-coin">
                <Sparkles className="h-2.5 w-2.5" /> 2× bonus
              </span>
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              {CURRENCY_SYMBOL}{perCoin.toFixed(3)} / coin
            </span>
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="mt-4">
        <EditableField
          canEdit={canEdit}
          editing={field === "price"}
          overridden={isOverridden("price")}
          onStart={() => startEdit("price", (effective.priceCents / 100).toFixed(2))}
          onCancel={() => setField(null)}
          onCommit={commit}
          onReset={() => resetField("price")}
          draft={draft}
          setDraft={setDraft}
          inputProps={{ type: "number", min: 0.01, step: 0.01, inputMode: "decimal" }}
          prefix={CURRENCY_SYMBOL}
          view={
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black tracking-tight">
                {CURRENCY_SYMBOL}{(effective.priceCents / 100).toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">one-time</span>
            </div>
          }
        />
      </div>

      {/* Description */}
      <div className="mt-3 flex-1">
        <EditableField
          canEdit={canEdit}
          editing={field === "description"}
          overridden={isOverridden("description")}
          onStart={() => startEdit("description", effective.description)}
          onCancel={() => setField(null)}
          onCommit={commit}
          onReset={() => resetField("description")}
          draft={draft}
          setDraft={setDraft}
          multiline
          inputProps={{ maxLength: 240 }}
          view={
            <p className="text-xs leading-relaxed text-muted-foreground">
              {effective.description}
            </p>
          }
        />
      </div>

      <button
        type="button"
        onClick={() => onBuy(effective)}
        disabled={field !== null}
        aria-label={`Buy ${effective.coins} OG Coins for ${CURRENCY_SYMBOL}${(effective.priceCents / 100).toFixed(2)}`}
        className={cn(
          "mt-5 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-bold transition-all disabled:opacity-50",
          accent
            ? "bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-90"
            : "border border-border bg-background/50 text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground",
        )}
      >
        Buy now
      </button>
    </div>
  );
}

// Inline editable field — pencil on hover, ✓/✗ to commit/cancel, ↺ to reset.
function EditableField({
  canEdit, editing, overridden,
  onStart, onCancel, onCommit, onReset,
  draft, setDraft,
  view, multiline = false, prefix, inputProps,
}: {
  canEdit: boolean;
  editing: boolean;
  overridden: boolean;
  onStart: () => void;
  onCancel: () => void;
  onCommit: () => void;
  onReset: () => void;
  draft: string;
  setDraft: (v: string) => void;
  view: ReactNode;
  multiline?: boolean;
  prefix?: string;
  inputProps?: Record<string, unknown>;
}) {
  if (editing) {
    return (
      <div className="rounded-md border border-primary/50 bg-primary/5 p-2">
        <div className="flex items-start gap-1.5">
          {prefix ? <span className="pt-1.5 text-sm font-bold">{prefix}</span> : null}
          {multiline ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...(inputProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onCommit(); }
                if (e.key === "Escape") { e.preventDefault(); onCancel(); }
              }}
              className="h-8 flex-1 text-sm"
              {...(inputProps as React.InputHTMLAttributes<HTMLInputElement>)}
            />
          )}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel} title="Cancel" aria-label="Cancel edit">
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" className="h-7 w-7 bg-emerald-500 text-white hover:bg-emerald-600" onClick={onCommit} title="Save" aria-label="Save changes">
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  if (!canEdit) return <>{view}</>;

  return (
    <div className="group/edit relative -mx-1 rounded px-1 outline-dashed outline-1 outline-transparent transition hover:outline-primary/40 hover:bg-primary/5">
      {view}
      <div className="pointer-events-none absolute right-0 top-0 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/edit:opacity-100">
        {overridden && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            className="pointer-events-auto grid h-5 w-5 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-foreground"
            title="Reset to default"
            aria-label="Reset"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onStart(); }}
          className="pointer-events-auto grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"
          title="Edit"
          aria-label="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      {overridden && (
        <span className="ml-1 inline-block align-middle text-[9px] font-bold uppercase tracking-wider text-primary">●</span>
      )}
    </div>
  );
}




function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="text-sm font-bold tabular-nums">{value}</span>
        {hint && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">{hint}</span>}
      </span>
    </div>
  );
}

function SectionDivider({
  id,
  eyebrow,
  title,
  icon,
  action,
  tone = "default",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "coin";
}) {
  const accent = tone === "coin" ? "via-coin/40" : "via-border";
  const chipTone = tone === "coin"
    ? "border-coin/40 bg-coin/10 text-coin"
    : "border-border bg-background/60 text-muted-foreground";
  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className={cn("h-px flex-1 bg-gradient-to-r from-transparent to-transparent", accent)} aria-hidden />
        <span className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] sm:gap-1.5 sm:px-3 sm:text-[10px] sm:tracking-[0.22em]",
          chipTone,
        )}>
          {icon}
          {eyebrow}
        </span>
        <span className={cn("h-px flex-1 bg-gradient-to-r from-transparent to-transparent", accent)} aria-hidden />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 sm:mt-3">
        <h2 id={id} className="font-display font-black tracking-tight text-foreground [font-size:clamp(1.125rem,5vw,1.5rem)] leading-tight">
          {title}
        </h2>
        {action}
      </div>
    </div>
  );
}

function NextStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-coin/50 bg-coin/15 text-[11px] font-black text-coin tabular-nums">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

function CustomPackCard({ onBuy }: { onBuy: (units: number) => void }) {
  const [units, setUnits] = useState<number>(CUSTOM_COIN_UNIT.minUnits);
  const [bumpError, setBumpError] = useState<string | null>(null);
  const coins = units * CUSTOM_COIN_UNIT.coins;
  const totalCents = units * CUSTOM_COIN_UNIT.priceCents;
  const minCoins = CUSTOM_COIN_UNIT.minUnits * CUSTOM_COIN_UNIT.coins;
  const maxCoins = CUSTOM_COIN_UNIT.maxUnits * CUSTOM_COIN_UNIT.coins;
  const atMin = units <= CUSTOM_COIN_UNIT.minUnits;
  const atMax = units >= CUSTOM_COIN_UNIT.maxUnits;
  // Per-coin price using consistent GBP rounding (3 dp for fractional pennies).
  const perCoin = CUSTOM_COIN_UNIT.priceCents / 100 / CUSTOM_COIN_UNIT.coins;




  const bump = (delta: number) => {
    const next = Math.min(
      CUSTOM_COIN_UNIT.maxUnits,
      Math.max(CUSTOM_COIN_UNIT.minUnits, units + delta),
    );
    if (next === units) {
      setBumpError(
        delta < 0
          ? `Minimum top-up is ${minCoins} coins.`
          : `Maximum custom top-up is ${maxCoins} coins.`,
      );
      return;
    }
    setBumpError(null);
    setUnits(next);
  };

  const quickPicks = [5, 10, 25, 50].filter((n) => n <= CUSTOM_COIN_UNIT.maxUnits);

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-red-500/40 bg-gradient-to-br from-[#1a0505] via-[#0b0202] to-[#170303] p-4 shadow-[0_0_60px_-15px_rgba(220,38,38,0.55)] sm:p-6">
      {/* Ambient flame background — non-interactive, behind everything */}
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-500/30 blur-3xl animate-pulse" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-orange-600/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-red-600/15 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative flex items-start gap-3 sm:gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-red-500/50 bg-red-500/15 text-red-300 shadow-[0_0_20px_-4px_rgba(239,68,68,0.7)] sm:h-14 sm:w-14">
          <Flame className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400/90">
            Build your stack
          </div>
          <h3 className="font-display text-xl font-black tracking-tight text-white sm:text-2xl">
            Custom OG Loot
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
              {CURRENCY_SYMBOL}{(CUSTOM_COIN_UNIT.priceCents / 100).toFixed(2)} → {CUSTOM_COIN_UNIT.coins} OG
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
              ≈ {CURRENCY_SYMBOL}{perCoin.toFixed(3)} / coin
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-white/70 sm:text-sm">
            Tap + or − to size your crate. Min {minCoins} · max {maxCoins} coins.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="relative mt-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-16 w-14 shrink-0 rounded-2xl border-red-500/40 bg-black/40 p-0 text-white hover:bg-red-500/20 hover:border-red-400 disabled:opacity-30 sm:h-20 sm:w-16"
          onClick={() => bump(-1)}
          disabled={atMin}
          aria-label={`Remove ${CUSTOM_COIN_UNIT.coins} coins`}
          title={atMin ? `Already at minimum (${minCoins} coins)` : `Remove ${CUSTOM_COIN_UNIT.coins} coins`}
        >
          <Minus className="h-7 w-7" />
        </Button>

        <div className="relative flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-red-500/40 bg-black/60 px-3 py-3 shadow-inner">
          {/* inner glow */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.18),transparent_70%)]" />
          <div className="relative text-[10px] font-black uppercase tracking-[0.28em] text-red-300/90">
            You get
          </div>
          <div className="relative mt-1 flex items-baseline justify-center gap-2 leading-none">
            <Coins className="h-6 w-6 shrink-0 text-coin drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
            <span
              key={coins}
              className="qty-flame qty-pop text-[clamp(2.5rem,12vw,4rem)] tabular-nums"
              aria-live="polite"
            >
              {coins}
            </span>
            <span className="text-xs font-black text-coin drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]">
              OG
            </span>
          </div>
          <div className="relative mt-1.5 text-[10px] font-black uppercase tracking-wider text-white/70 tabular-nums">
            {units} × {CURRENCY_SYMBOL}{(CUSTOM_COIN_UNIT.priceCents / 100).toFixed(2)}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-16 w-14 shrink-0 rounded-2xl border-red-500/40 bg-black/40 p-0 text-white hover:bg-red-500/20 hover:border-red-400 disabled:opacity-30 sm:h-20 sm:w-16"
          onClick={() => bump(1)}
          disabled={atMax}
          aria-label={`Add ${CUSTOM_COIN_UNIT.coins} coins`}
          title={atMax ? `Already at maximum (${maxCoins} coins)` : `Add ${CUSTOM_COIN_UNIT.coins} coins`}
        >
          <Plus className="h-7 w-7" />
        </Button>
      </div>

      {/* Quick picks */}
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        {quickPicks.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => { setBumpError(null); setUnits(q); }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition",
              units === q
                ? "border-red-400 bg-red-500/25 text-white shadow-[0_0_16px_-2px_rgba(239,68,68,0.7)]"
                : "border-white/15 bg-black/40 text-white/70 hover:border-red-400/60 hover:text-white",
            )}
          >
            +{q * CUSTOM_COIN_UNIT.coins} · {CURRENCY_SYMBOL}{((q * CUSTOM_COIN_UNIT.priceCents) / 100).toFixed(2)}
          </button>
        ))}
      </div>

      {bumpError ? (
        <p role="alert" className="relative mt-2 text-[11px] font-bold text-red-300">
          {bumpError}
        </p>
      ) : (atMin || atMax) ? (
        <p className="relative mt-2 text-[11px] text-white/60">
          {atMin ? `You're at the minimum (${minCoins} coins).` : `You're at the maximum (${maxCoins} coins).`}
        </p>
      ) : null}

      {/* Total + CTA */}
      <div className="relative mt-5 flex flex-col gap-3 border-t border-red-500/25 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-300/90">Total</div>
          <div
            key={totalCents}
            className="qty-flame qty-pop text-[clamp(2rem,8vw,2.75rem)] tabular-nums leading-none"
          >
            {CURRENCY_SYMBOL}{(totalCents / 100).toFixed(2)}
          </div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-white/70">
            one-time · {coins} OG coins
          </div>
        </div>
        <Button
          size="lg"
          onClick={() => onBuy(units)}
          className="w-full shrink-0 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-orange-500 font-black uppercase tracking-wide text-white shadow-[0_0_30px_-4px_rgba(239,68,68,0.8)] transition-transform hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 sm:w-auto"
        >
          <Flame className="mr-2 h-4 w-4" /> Buy · {CURRENCY_SYMBOL}{(totalCents / 100).toFixed(2)}
        </Button>
      </div>
    </div>
  );
}



