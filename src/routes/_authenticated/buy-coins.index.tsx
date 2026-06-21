import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, Check, ArrowLeft, Crown, Star, Zap, ShieldCheck, Lock, Sparkles, MessageSquare, Music2, Wand2, Infinity as InfinityIcon, TrendingDown, Gift, Pencil, X, Loader2, CreditCard, Plus, Minus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EditableContent } from "@/components/admin/EditableContent";
import { useAdminEditMode } from "@/components/admin/AdminEditMode";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { useSiteContent, useSetSiteContent } from "@/hooks/use-site-content";
import { cn } from "@/lib/utils";
import { COIN_PACKS, CURRENCY_SYMBOL, VIP_PLAN, CUSTOM_COIN_UNIT, findCoinPackByBundleId, type CoinPack } from "@/lib/coin-packs";
import { StripeEmbeddedCheckoutInline } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { CirculatingCoins } from "@/components/CirculatingCoins";
import { toast } from "sonner";

const SELECTION_STORAGE_KEY = "buyCoins.lastSelection";

type StoredSelection =
  | { type: "coins"; bundleId: string }
  | { type: "custom"; units: number }
  | { type: "vip" };

type Selection =
  | { type: "coins"; pack: CoinPack }
  | { type: "custom"; units: number }
  | { type: "vip" };

export const Route = createFileRoute("/_authenticated/buy-coins/")({
  component: BuyCoinsPage,
});

function BuyCoinsPage() {
  const { data: profile } = useProfile();
  const { isVip } = useRole();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [stage, setStage] = useState<"confirm" | "pay">("confirm");

  // Restore previous selection (e.g. after a canceled Stripe checkout).
  useEffect(() => {
    if (selected) return;
    try {
      const raw = sessionStorage.getItem(SELECTION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredSelection;
      if (parsed.type === "vip") {
        setSelected({ type: "vip" });
        setStage("confirm");
        toast.info("We brought you back to your last selection.");
      } else if (parsed.type === "coins") {
        const pack = findCoinPackByBundleId(parsed.bundleId);
        if (pack) {
          setSelected({ type: "coins", pack });
          setStage("confirm");
          toast.info("We brought you back to your last selection.");
        }
      } else if (parsed.type === "custom") {
        const u = Math.min(Math.max(parsed.units, CUSTOM_COIN_UNIT.minUnits), CUSTOM_COIN_UNIT.maxUnits);
        setSelected({ type: "custom", units: u });
        setStage("confirm");
        toast.info("We brought you back to your last selection.");
      }
    } catch {
      /* ignore */
    }
  }, [selected]);

  const pickSelection = (s: Selection) => {
    const stored: StoredSelection =
      s.type === "vip"
        ? { type: "vip" }
        : s.type === "custom"
        ? { type: "custom", units: s.units }
        : { type: "coins", bundleId: s.pack.bundleId };
    try { sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(stored)); } catch { /* ignore */ }
    setSelected(s);
    setStage("confirm");
  };

  const clearSelection = () => {
    try { sessionStorage.removeItem(SELECTION_STORAGE_KEY); } catch { /* ignore */ }
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
                    {labelForOrder}
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
            {stage === "confirm" ? (
              <div className="p-5 sm:p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Confirm your order
                </p>
                <div className="mt-3 grid gap-2 rounded-2xl border border-border bg-background/40 p-4 text-sm">
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
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {isVipFlow
                    ? "You'll be charged yearly. Cancel anytime from Settings."
                    : "One-time charge. Coins are credited to your balance within seconds and never expire."}
                </p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={clearSelection}>Cancel</Button>
                  <Button
                    onClick={() => setStage("pay")}
                    className="bg-gradient-brand font-bold text-primary-foreground shadow-glow hover:opacity-90"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Continue to payment · {CURRENCY_SYMBOL}{(totalCents / 100).toFixed(2)}
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
    <DashboardShell title="OG Coins Store">
      <PaymentTestModeBanner />
      <div className="mx-auto w-full max-w-6xl space-y-10">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-coin/40 bg-gradient-to-br from-coin/25 via-card to-card p-6 shadow-card sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-coin/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative grid gap-8 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-coin/40 bg-coin/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-coin">
                <Sparkles className="h-3 w-3" /> OG Coins Store
              </span>
              <h1 className="mt-4 break-words font-display text-[clamp(2rem,7vw,3.75rem)] font-black leading-[1.02] tracking-tight text-gradient-brand">
                <EditableContent contentKey="buyCoins.heading" defaultValue="Top up. Create more." />
              </h1>
              <p className="mt-3 max-w-xl text-base font-medium text-muted-foreground sm:text-lg">
                <EditableContent
                  contentKey="buyCoins.subtitle"
                  defaultValue="1 OG Coin = 1 message or 1 generation across Music Hub & OG Messenger. New here? You got 5 OG Coins free."
                  multiline
                />
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><InfinityIcon className="h-4 w-4 text-coin" /> Never expire</span>
                <span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4 text-coin" /> Instant top-up</span>
                <span className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4 text-coin" /> Secure checkout</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-coin" /> Apple / Google Pay</span>
              </div>
            </div>
            <div className="rounded-2xl border border-coin/30 bg-background/60 p-5 backdrop-blur-sm sm:min-w-[220px]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Your balance
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <Coins className="h-7 w-7 text-coin" />
                <span className="text-[clamp(2.25rem,8vw,3rem)] font-black tabular-nums leading-none text-foreground">
                  {profile?.coin_balance ?? 0}
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-coin">OG Coins</p>
            </div>
          </div>
        </section>

        {/* What you can do */}
        <section className="grid gap-3 sm:grid-cols-3">
          <ValueProp icon={<MessageSquare className="h-5 w-5" />} title="Message OGs" body="Spend 1 coin per reply in OG Messenger." />
          <ValueProp icon={<Music2 className="h-5 w-5" />} title="Generate tracks" body="Lyrics, beats & full songs in Music Hub." />
          <ValueProp icon={<Wand2 className="h-5 w-5" />} title="Unlock portals" body="Spin up custom AI portals on demand." />
        </section>

        {/* Live coin economy snapshot */}
        <CirculatingCoins />

        {/* Coin packs */}
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-black tracking-tight sm:text-2xl md:text-3xl">Pick your pack</h2>
              <p className="text-sm text-muted-foreground">Bigger packs = better price per coin. Coins never expire.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30 sm:text-xs">
              <TrendingDown className="h-3.5 w-3.5" /> Save up to {Math.round((1 - (COIN_PACKS[COIN_PACKS.length - 1].priceCents / 100 / COIN_PACKS[COIN_PACKS.length - 1].coins) / basePerCoin) * 100)}%
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {COIN_PACKS.map((t) => (
              <PackCard
                key={t.bundleId}
                pack={t}
                basePerCoin={basePerCoin}
                onBuy={(effective) => pickSelection({ type: "coins", pack: effective })}
              />
            ))}
          </div>

          {/* Custom pack */}
          <div className="mt-6">
            <CustomPackCard onBuy={(units) => pickSelection({ type: "custom", units })} />
          </div>

          <p className="mt-4 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Lock className="h-3 w-3" /> Secure checkout · Apple Pay · Google Pay · Card
          </p>
        </section>

        {/* VIP yearly subscription */}
        <section>
          <div className="mb-4">
            <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
              <EditableContent contentKey="buyCoins.vip.heading" defaultValue="Or go all-in with OG VIP" />
            </h2>
            <p className="text-sm text-muted-foreground">
              <EditableContent
                contentKey="buyCoins.vip.subtitle"
                defaultValue="Unlock exclusive privileges across OG Streamz for a full year."
                multiline
              />
            </p>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-coin/40 bg-gradient-to-br from-coin/15 via-card to-card p-6 shadow-card sm:p-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-coin/25 blur-3xl" />
            <div className="relative grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-coin/20 shadow-glow">
                <Crown className="h-8 w-8 text-coin" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold">OG VIP</h3>
                  {isVip && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30">
                      Active
                    </span>
                  )}
                </div>
                <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                  <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 shrink-0 text-coin" /> Priority OG Messenger replies</li>
                  <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 shrink-0 text-coin" /> VIP badge across the hub</li>
                  <li className="flex items-center gap-2"><Star className="h-3.5 w-3.5 shrink-0 text-coin" /> Early access to new portals</li>
                  <li className="flex items-center gap-2"><Gift className="h-3.5 w-3.5 shrink-0 text-coin" /> Bonus monthly OG Coin drops</li>
                </ul>
              </div>
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                <div className="text-right">
                  <div className="text-3xl font-black tabular-nums leading-none">
                    {CURRENCY_SYMBOL}{(VIP_PLAN.priceCents / 100).toFixed(0)}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-muted-foreground">/ year</div>
                </div>
                <Button
                  size="lg"
                  disabled={isVip}
                  onClick={() => pickSelection({ type: "vip" })}
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

        {/* Trust strip */}
        <section className="grid gap-3 rounded-2xl border border-border bg-card/60 p-5 sm:grid-cols-3">
          <TrustItem icon={<ShieldCheck className="h-5 w-5 text-emerald-400" />} title="Secure by Stripe" body="PCI-compliant checkout, your card never touches our servers." />
          <TrustItem icon={<InfinityIcon className="h-5 w-5 text-coin" />} title="Coins never expire" body="Top up once, use whenever — no monthly resets." />
          <TrustItem icon={<Check className="h-5 w-5 text-primary" />} title="Instant credit" body="Coins land in your balance the moment payment clears." />
        </section>

        <p className="text-center text-xs text-muted-foreground">
          <EditableContent
            contentKey="buyCoins.footer"
            defaultValue="Questions? Tap OG Messenger and we'll sort it. VAT included where applicable."
            multiline
          />
        </p>
      </div>
    </DashboardShell>
  );
}

// ---------- Pack card with admin inline edit ----------

interface PackOverride {
  label?: string;
  description?: string;
  priceCents?: number;
  coins?: number;
}

function packOverrideKey(bundleId: string) {
  return `buyCoins.pack.${bundleId}`;
}

function parseOverride(raw: string | undefined): PackOverride {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as PackOverride) : {};
  } catch {
    return {};
  }
}

function PackCard({
  pack,
  basePerCoin,
  onBuy,
}: {
  pack: CoinPack;
  basePerCoin: number;
  onBuy: (effective: CoinPack) => void;
}) {
  const { isAdmin } = useRole();
  const { enabled } = useAdminEditMode();
  const { get } = useSiteContent();
  const setMut = useSetSiteContent();
  const canEdit = isAdmin && enabled;

  const raw = get(packOverrideKey(pack.bundleId), "");
  const override = useMemo(() => parseOverride(raw), [raw]);

  const effective: CoinPack = {
    ...pack,
    label: override.label ?? pack.label,
    description: override.description ?? pack.description,
    priceCents: override.priceCents ?? pack.priceCents,
    coins: override.coins ?? pack.coins,
  };

  const perCoin = effective.priceCents / 100 / effective.coins;
  const savingsPct = basePerCoin > 0 ? Math.round((1 - perCoin / basePerCoin) * 100) : 0;
  const accent = pack.bestValue || pack.popular;

  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(effective.label);
  const [draftDesc, setDraftDesc] = useState(effective.description);
  const [draftPrice, setDraftPrice] = useState((effective.priceCents / 100).toFixed(2));
  const [draftCoins, setDraftCoins] = useState(String(effective.coins));

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraftLabel(effective.label);
    setDraftDesc(effective.description);
    setDraftPrice((effective.priceCents / 100).toFixed(2));
    setDraftCoins(String(effective.coins));
    setEditing(true);
  }

  function save() {
    const priceNum = Number.parseFloat(draftPrice);
    const coinsNum = Number.parseInt(draftCoins, 10);
    if (!draftLabel.trim()) return toast.error("Label required");
    if (!Number.isFinite(priceNum) || priceNum < 0.5) return toast.error("Price must be ≥ 0.50");
    if (!Number.isInteger(coinsNum) || coinsNum < 1) return toast.error("Coins must be a positive integer");
    const payload: PackOverride = {
      label: draftLabel.trim(),
      description: draftDesc.trim() || pack.description,
      priceCents: Math.round(priceNum * 100),
      coins: coinsNum,
    };
    setMut.mutate(
      { key: packOverrideKey(pack.bundleId), value: JSON.stringify(payload) },
      {
        onSuccess: () => {
          toast.success("Pack saved site-wide");
          setEditing(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  if (editing) {
    return (
      <div
        className={cn(
          "relative flex flex-col rounded-2xl border-2 border-primary bg-card p-5 shadow-glow",
        )}
      >
        <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          <Pencil className="h-3 w-3" /> Editing pack
        </div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Label</label>
        <Input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} maxLength={40} className="mt-1 h-9" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Coins</label>
            <Input type="number" min={1} value={draftCoins} onChange={(e) => setDraftCoins(e.target.value)} className="mt-1 h-9 tabular-nums" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price ({CURRENCY_SYMBOL})</label>
            <Input type="number" step="0.01" min={0.5} value={draftPrice} onChange={(e) => setDraftPrice(e.target.value)} className="mt-1 h-9 tabular-nums" />
          </div>
        </div>
        <label className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea
          value={draftDesc}
          onChange={(e) => setDraftDesc(e.target.value)}
          rows={3}
          maxLength={240}
          className="mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          Display only — Stripe still charges the original price for{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{pack.priceId}</code>.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-10 w-10 border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-500"
            onClick={() => setEditing(false)}
            title="Cancel"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 bg-emerald-500 text-white hover:bg-emerald-600"
            disabled={setMut.isPending}
            onClick={save}
            title="Save"
            aria-label="Save"
          >
            {setMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onBuy(effective)}
        aria-label={`Buy ${effective.coins} OG Coins for ${CURRENCY_SYMBOL}${(effective.priceCents / 100).toFixed(2)}`}
        className={cn(
          "group relative flex w-full flex-col rounded-2xl border bg-card p-5 text-left shadow-card transition-all",
          "hover:-translate-y-1 hover:shadow-glow",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:translate-y-0",
          accent ? "border-primary shadow-glow" : "border-border hover:border-primary/40",
        )}
      >
        {pack.popular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow whitespace-nowrap">
            <Sparkles className="h-3 w-3" /> Most popular
          </div>
        )}
        {pack.bestValue && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-coin px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-background shadow whitespace-nowrap">
            <Crown className="h-3 w-3" /> Best value
          </div>
        )}
        {savingsPct > 0 && (
          <div className="absolute right-3 top-3 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30">
            Save {savingsPct}%
          </div>
        )}
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {effective.label}
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-coin/15 transition-transform group-hover:scale-110 group-hover:-rotate-6">
            <Coins className="h-6 w-6 text-coin" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="text-3xl font-black tabular-nums text-foreground">{effective.coins}</span>
              <span className="text-xs font-bold text-coin">Coins</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {CURRENCY_SYMBOL}{perCoin.toFixed(3)} / coin
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-2xl font-black tracking-tight">
            {CURRENCY_SYMBOL}{(effective.priceCents / 100).toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground">one-time</span>
        </div>
        <p className="mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">
          {effective.description}
        </p>
        <div
          className={cn(
            "mt-5 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-bold transition-all",
            accent
              ? "bg-gradient-brand text-primary-foreground shadow-glow group-hover:opacity-90"
              : "border border-border bg-background/50 text-foreground group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground",
          )}
        >
          Buy now
        </div>
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={startEdit}
          title="Edit pack (boss)"
          aria-label="Edit pack"
          className="absolute left-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-primary/40 bg-background/90 text-primary shadow-sm transition hover:bg-primary hover:text-primary-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ValueProp({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
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

function CustomPackCard({ onBuy }: { onBuy: (units: number) => void }) {
  const [units, setUnits] = useState<number>(CUSTOM_COIN_UNIT.minUnits);
  const coins = units * CUSTOM_COIN_UNIT.coins;
  const totalCents = units * CUSTOM_COIN_UNIT.priceCents;
  const atMin = units <= CUSTOM_COIN_UNIT.minUnits;
  const atMax = units >= CUSTOM_COIN_UNIT.maxUnits;

  const dec = () => setUnits((u) => Math.max(CUSTOM_COIN_UNIT.minUnits, u - 1));
  const inc = () => setUnits((u) => Math.min(CUSTOM_COIN_UNIT.maxUnits, u + 1));

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <SlidersHorizontal className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-black tracking-tight sm:text-xl">Custom amount</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              {CURRENCY_SYMBOL}{(CUSTOM_COIN_UNIT.priceCents / 100).toFixed(2)} per {CUSTOM_COIN_UNIT.coins} coins
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Tap − or + to add or remove {CUSTOM_COIN_UNIT.coins} coins at a time.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-11 w-11 shrink-0 rounded-full"
              onClick={dec}
              disabled={atMin}
              aria-label={`Remove ${CUSTOM_COIN_UNIT.coins} coins`}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <div className="flex-1 rounded-2xl border border-border bg-background/60 px-4 py-3 text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">You get</div>
              <div className="mt-0.5 flex items-baseline justify-center gap-1.5 leading-none">
                <Coins className="h-5 w-5 shrink-0 text-coin" />
                <span className="text-[clamp(1.75rem,6vw,2.25rem)] font-black tabular-nums text-foreground">{coins}</span>
                <span className="text-xs font-bold text-coin">OG Coins</span>
              </div>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-11 w-11 shrink-0 rounded-full"
              onClick={inc}
              disabled={atMax}
              aria-label={`Add ${CUSTOM_COIN_UNIT.coins} coins`}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          {atMax && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Max custom top-up is {CUSTOM_COIN_UNIT.maxUnits * CUSTOM_COIN_UNIT.coins} coins.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
          <div className="text-right">
            <div className="text-[clamp(1.5rem,5vw,2rem)] font-black tabular-nums leading-none">
              {CURRENCY_SYMBOL}{(totalCents / 100).toFixed(2)}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">one-time</div>
          </div>
          <Button
            size="lg"
            onClick={() => onBuy(units)}
            className="bg-gradient-brand font-bold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0"
          >
            <CreditCard className="mr-2 h-4 w-4" /> Buy {coins} coins
          </Button>
        </div>
      </div>
    </div>
  );
}

