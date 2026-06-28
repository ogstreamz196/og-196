import { Coins, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

/**
 * Header Coin Balance pill — prominent, tappable, realtime.
 * - Subscribes via `useProfile` which listens to Supabase Realtime
 *   so the balance updates instantly after Stripe checkout and after
 *   generation jobs settle.
 * - Mobile: shows just the icon + number with a "+" affordance, links
 *   straight to /buy-coins (44px tap target).
 * - sm+: shows the "OG coins" label too.
 */
export function CoinBalance({ className }: { className?: string }) {
  const { data, isLoading } = useProfile();
  const balance = isLoading ? "—" : (data?.coin_balance ?? 0);

  return (
    <Link
      to="/buy-coins"
      preload="intent"
      aria-label={`OG coin balance: ${balance}. Tap to buy more.`}
      title="OG coin balance — tap to buy more"
      className={cn(
        "group inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border-2 border-coin/40 bg-gradient-to-r from-coin/15 via-amber-500/10 to-coin/15 px-2.5 py-1 shadow-[0_0_18px_-4px_rgba(245,158,11,0.45)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-coin/70 hover:shadow-[0_0_24px_-2px_rgba(245,158,11,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-coin/60 sm:gap-2 sm:px-3.5 sm:py-1.5",
        className,
      )}
    >
      <Coins
        aria-hidden
        className={cn(
          "h-4 w-4 text-coin transition-transform group-hover:scale-110 sm:h-[1.05rem] sm:w-[1.05rem]",
          isLoading ? "animate-pulse" : "",
        )}
      />
      <span
        data-testid="coin-balance"
        aria-live="polite"
        className="font-display text-sm font-black leading-none tabular-nums text-coin drop-shadow-[0_0_8px_rgba(245,158,11,0.45)] sm:text-base"
      >
        {balance}
      </span>
      <span className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-coin/80 sm:inline">
        OG&nbsp;coins
      </span>
      <span
        aria-hidden
        className="ml-0.5 inline-grid h-5 w-5 place-items-center rounded-full bg-coin/20 text-coin transition-colors group-hover:bg-coin/40 sm:h-[1.25rem] sm:w-[1.25rem]"
      >
        <Plus className="h-3 w-3" strokeWidth={3} />
      </span>
    </Link>
  );
}
