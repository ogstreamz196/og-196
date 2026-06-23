import { Link } from "@tanstack/react-router";
import { Sparkles, Wand2, Library, Coins, Zap, ShieldCheck, Crown } from "lucide-react";

interface HomeHeroProps {
  balance: number;
  isAdmin: boolean;
  isVip: boolean;
}

export function HomeHero({ balance, isAdmin, isVip }: HomeHeroProps) {
  return (
    <section className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-card/60 p-8 text-center shadow-card backdrop-blur-xl bg-gradient-hero sm:p-12 md:p-16">
      {/* Ambient aurora */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-gradient-brand opacity-20 blur-3xl wc-blob"
      />

      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/60 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
        <Sparkles className="h-3 w-3 text-primary" />
        OG Streamz — powered by OG Bot
      </div>

      <h1 className="mt-7 text-balance text-[clamp(2.25rem,6vw,5rem)] font-bold leading-[1.02] tracking-tight">
        <span className="text-gradient-brand">OG Bot</span>
        <br className="hidden md:block" />
        <span className="text-gradient-metal"> Music Hub</span>
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
        Generate, stream, and manage your tracks — all in one place.
        OG Bot is your AI studio co-pilot: describe an idea, pick a portal, and watch it come to life.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/portals"
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-brand px-7 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_60px_-12px_oklch(0.55_0.22_268/0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Wand2 className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
          Start Creating
        </Link>
        <Link
          to="/library"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/40 px-7 py-3 text-sm font-semibold text-foreground backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-background/60"
        >
          <Library className="h-4 w-4" /> MusicHUB
        </Link>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
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
