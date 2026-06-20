import { Link } from "@tanstack/react-router";
import { Sparkles, Wand2, Library, Coins, Zap, ShieldCheck, Crown } from "lucide-react";

interface HomeHeroProps {
  balance: number;
  isAdmin: boolean;
  isVip: boolean;
}

export function HomeHero({ balance, isAdmin, isVip }: HomeHeroProps) {
  return (
    <section className="relative w-full overflow-hidden rounded-3xl border border-border bg-card p-10 text-center shadow-card bg-gradient-hero md:p-16">
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
        <Sparkles className="h-3 w-3 text-primary" />
        OG Streamz — powered by OG Bot
      </div>

      <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl">
        <span className="text-gradient-brand">OG Bot</span>
        <br className="hidden md:block" />
        <span className="text-gradient-metal"> Music Hub</span>
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
        Generate, stream, and manage your tracks — all in one place.
        OG Bot is your AI studio co-pilot: describe an idea, pick a portal, and watch it come to life.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/portals"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          <Wand2 className="h-4 w-4" /> Start Creating
        </Link>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-7 py-3 text-sm font-semibold text-foreground backdrop-blur transition hover:border-primary/40"
        >
          <Library className="h-4 w-4" /> My Library
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-coin/40 bg-coin/10 px-3 py-1.5 text-sm font-medium text-coin">
          <Coins className="h-4 w-4" /> {balance} OG coins
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
          <Zap className="h-4 w-4" /> 1 coin / track
        </span>
        {isAdmin && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" /> Boss
          </span>
        )}
        {isVip && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-500">
            <Crown className="h-4 w-4" /> VIP
          </span>
        )}
      </div>
    </section>
  );
}
