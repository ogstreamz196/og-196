import type { ReactNode } from "react";
import { Coins, Package, Sparkles, Crown, Gem, ShoppingBag, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoinPill } from "@/components/ui/coin-pill";
import type { StoreItem } from "@/lib/store.functions";
import { cn } from "@/lib/utils";

const RARITY: Record<StoreItem["rarity"], { label: string; ring: string; glow: string; icon: ReactNode }> = {
  common: {
    label: "Common",
    ring: "border-slate-500/40",
    glow: "shadow-[0_0_24px_-8px_hsl(220_10%_60%/.4)]",
    icon: <Package className="h-3 w-3" />,
  },
  rare: {
    label: "Rare",
    ring: "border-cyan-400/50",
    glow: "shadow-[0_0_28px_-6px_hsl(190_90%_55%/.55)]",
    icon: <Sparkles className="h-3 w-3" />,
  },
  epic: {
    label: "Epic",
    ring: "border-fuchsia-400/60",
    glow: "shadow-[0_0_32px_-4px_hsl(290_90%_60%/.6)]",
    icon: <Gem className="h-3 w-3" />,
  },
  legendary: {
    label: "Legendary",
    ring: "border-amber-400/70",
    glow: "shadow-[0_0_36px_-2px_hsl(40_100%_55%/.7)]",
    icon: <Crown className="h-3 w-3" />,
  },
};

function formatPrice(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function StoreItemCard({
  item,
  onBuy,
  buying,
}: {
  item: StoreItem;
  onBuy: (id: string) => void;
  buying?: boolean;
}) {
  const r = RARITY[item.rarity];
  const stockRemaining = item.stock === null ? null : Math.max(0, item.stock - item.stock_sold);
  const soldOut = stockRemaining !== null && stockRemaining === 0;

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-3xl border-2 bg-card/60 p-4 backdrop-blur transition hover:-translate-y-1",
        r.ring,
        r.glow,
      )}
    >
      {/* rarity badge */}
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
          {r.icon}
          {r.label}
        </span>
        {item.recurring_interval && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
            <Repeat className="h-3 w-3" /> /{item.recurring_interval}
          </span>
        )}
      </div>

      {/* image */}
      <div className="mb-3 aspect-square w-full overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-primary/10 to-black/40">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-primary/60">
            <ShoppingBag className="h-16 w-16" />
          </div>
        )}
      </div>

      {/* name + desc */}
      <h3 className="line-clamp-2 font-display text-lg font-bold uppercase tracking-tight text-white">
        {item.name}
      </h3>
      {item.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
      )}

      {/* meta pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.coin_reward ? (
          <CoinPill size="sm">+{item.coin_reward} coins</CoinPill>
        ) : null}
        {item.perk_slug && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
            <Sparkles className="h-3 w-3" /> {item.perk_slug.replace("role:", "")}
          </span>
        )}
        {stockRemaining !== null && (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase",
              soldOut
                ? "bg-destructive/20 text-destructive"
                : stockRemaining <= 5
                ? "bg-amber-500/20 text-amber-300"
                : "bg-white/5 text-muted-foreground",
            )}
          >
            {soldOut ? "Sold out" : `${stockRemaining} left`}
          </span>
        )}
      </div>

      {/* footer */}
      <div className="mt-auto flex items-end justify-between pt-4">
        <div className="flame-heading text-2xl font-display font-black leading-none">
          {formatPrice(item.price_cents, item.currency)}
        </div>
        <Button
          size="sm"
          onClick={() => onBuy(item.id)}
          disabled={soldOut || buying}
          className="bg-gradient-brand font-bold uppercase tracking-wider"
        >
          <Coins className="mr-1 h-4 w-4" />
          {soldOut ? "Sold out" : buying ? "…" : "Buy"}
        </Button>
      </div>
    </div>
  );
}
