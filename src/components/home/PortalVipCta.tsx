import { Link } from "@tanstack/react-router";
import { Bot, Crown, ArrowRight } from "lucide-react";

export function PortalVipCta() {
  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <h3 className="text-xl font-bold">OG Bot Portal</h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Mint API tokens and drop the OG Bot widget onto your own website.
          Bring the Music Hub experience to any domain you own.
        </p>
        <Link
          to="/og-bot/connect"
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/40"
        >
          <Bot className="h-4 w-4" /> Connect Portal <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20">
            <Crown className="h-5 w-5 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold">OG VIP</h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Priority generation, exclusive badges, and VIP-only portal access.
          Unlock the full power of the Music Hub.
        </p>
        <Link
          to="/buy-coins"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-amber-950 transition hover:opacity-90"
        >
          <Crown className="h-4 w-4" /> Go VIP <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
