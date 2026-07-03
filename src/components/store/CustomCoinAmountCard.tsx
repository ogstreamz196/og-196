import { useState } from "react";
import { Coins, Flame, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CUSTOM_COIN_UNIT, CURRENCY_SYMBOL } from "@/lib/coin-packs";
import { cn } from "@/lib/utils";

/**
 * Compact "build your custom coin stack" card shown as the store's
 * landing hero above the category tabs. Mirrors the buy-coins CustomPackCard
 * but tuned for a single-row layout on the store page. Buying opens the
 * store's shared Stripe checkout dialog via onBuy(units).
 */
export function CustomCoinAmountCard({ onBuy }: { onBuy: (units: number) => void }) {
  const [units, setUnits] = useState<number>(CUSTOM_COIN_UNIT.minUnits);
  const coins = units * CUSTOM_COIN_UNIT.coins;
  const totalCents = units * CUSTOM_COIN_UNIT.priceCents;
  const minCoins = CUSTOM_COIN_UNIT.minUnits * CUSTOM_COIN_UNIT.coins;
  const maxCoins = CUSTOM_COIN_UNIT.maxUnits * CUSTOM_COIN_UNIT.coins;
  const atMin = units <= CUSTOM_COIN_UNIT.minUnits;
  const atMax = units >= CUSTOM_COIN_UNIT.maxUnits;
  const perCoin = CUSTOM_COIN_UNIT.priceCents / 100 / CUSTOM_COIN_UNIT.coins;

  const bump = (d: number) =>
    setUnits((u) =>
      Math.min(CUSTOM_COIN_UNIT.maxUnits, Math.max(CUSTOM_COIN_UNIT.minUnits, u + d)),
    );

  const quickPicks = [5, 10, 25, 50].filter((n) => n <= CUSTOM_COIN_UNIT.maxUnits);

  return (
    <section
      aria-labelledby="store-custom-amount-title"
      className="relative overflow-hidden rounded-3xl border-2 border-red-500/40 bg-gradient-to-br from-[#1a0505] via-[#0b0202] to-[#170303] p-4 shadow-[0_0_60px_-15px_rgba(220,38,38,0.55)] sm:p-6"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-500/30 blur-3xl animate-pulse" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-orange-600/20 blur-3xl" />
      </div>

      <div className="relative flex items-start gap-3 sm:gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-red-500/50 bg-red-500/15 text-red-300 shadow-[0_0_20px_-4px_rgba(239,68,68,0.7)] sm:h-14 sm:w-14">
          <Flame className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400/90">
            Build your stack
          </div>
          <h2
            id="store-custom-amount-title"
            className="font-display text-xl font-black tracking-tight text-white sm:text-2xl"
          >
            Custom coin amount
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
              {CURRENCY_SYMBOL}
              {(CUSTOM_COIN_UNIT.priceCents / 100).toFixed(2)} → {CUSTOM_COIN_UNIT.coins} OG
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
              ≈ {CURRENCY_SYMBOL}
              {perCoin.toFixed(3)} / coin
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-white/70 sm:text-sm">
            Tap + or − to size your crate. Min {minCoins} · max {maxCoins} coins.
          </p>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-16 w-14 shrink-0 rounded-2xl border-red-500/40 bg-black/40 p-0 text-white hover:bg-red-500/20 hover:border-red-400 disabled:opacity-30 sm:h-20 sm:w-16"
          onClick={() => bump(-1)}
          disabled={atMin}
          aria-label={`Remove ${CUSTOM_COIN_UNIT.coins} coins`}
        >
          <Minus className="h-7 w-7" />
        </Button>

        <div className="relative flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-red-500/40 bg-black/60 px-3 py-3 shadow-inner">
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.18),transparent_70%)]" />
          <div className="relative text-[10px] font-black uppercase tracking-[0.28em] text-red-300/90">
            You get
          </div>
          <div className="relative mt-1 flex items-baseline justify-center gap-2 leading-none">
            <Coins className="h-6 w-6 shrink-0 text-coin drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
            <span
              key={coins}
              className="qty-flame qty-pop text-[clamp(2.25rem,10vw,3.5rem)] tabular-nums"
              aria-live="polite"
            >
              {coins}
            </span>
            <span className="text-xs font-black text-coin">OG</span>
          </div>
          <div className="relative mt-1.5 text-[10px] font-black uppercase tracking-wider text-white/70 tabular-nums">
            {units} × {CURRENCY_SYMBOL}
            {(CUSTOM_COIN_UNIT.priceCents / 100).toFixed(2)}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-16 w-14 shrink-0 rounded-2xl border-red-500/40 bg-black/40 p-0 text-white hover:bg-red-500/20 hover:border-red-400 disabled:opacity-30 sm:h-20 sm:w-16"
          onClick={() => bump(1)}
          disabled={atMax}
          aria-label={`Add ${CUSTOM_COIN_UNIT.coins} coins`}
        >
          <Plus className="h-7 w-7" />
        </Button>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-1.5">
        {quickPicks.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setUnits(q)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition",
              units === q
                ? "border-red-400 bg-red-500/25 text-white shadow-[0_0_16px_-2px_rgba(239,68,68,0.7)]"
                : "border-white/15 bg-black/40 text-white/70 hover:border-red-400/60 hover:text-white",
            )}
          >
            +{q * CUSTOM_COIN_UNIT.coins} · {CURRENCY_SYMBOL}
            {((q * CUSTOM_COIN_UNIT.priceCents) / 100).toFixed(2)}
          </button>
        ))}
      </div>

      <div className="relative mt-5 flex flex-col gap-3 border-t border-red-500/25 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-300/90">
            Total
          </div>
          <div
            key={totalCents}
            className="qty-flame qty-pop text-[clamp(1.75rem,7vw,2.5rem)] tabular-nums leading-none"
          >
            {CURRENCY_SYMBOL}
            {(totalCents / 100).toFixed(2)}
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
          <Flame className="mr-2 h-4 w-4" /> Buy · {CURRENCY_SYMBOL}
          {(totalCents / 100).toFixed(2)}
        </Button>
      </div>
    </section>
  );
}
