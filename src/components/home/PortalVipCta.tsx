import { Link } from "@tanstack/react-router";
import { Crown, ArrowRight } from "lucide-react";
import { FlameHeading } from "@/components/ui/flame-heading";

export function PortalVipCta() {
  return (
    <section className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 shadow-card">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20">
          <Crown className="h-5 w-5 text-amber-500" />
        </div>
        <h3 className="font-bungee text-3xl sm:text-4xl">OG VIP</h3>
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
    </section>
  );
}
