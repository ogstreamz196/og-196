import { Link } from "@tanstack/react-router";
import { ShieldCheck, Music2, Globe2 } from "lucide-react";

/**
 * Sticky in-page nav for the Boss-only admin surface.
 * Jumps between Bot Control Center, Music Hub Portal, and the public Sales View.
 */
export function BossNav() {
  return (
    <div className="sticky top-16 z-10 mb-6 -mx-4 md:-mx-8">
      <div className="glass-panel-strong border-y border-primary/30 px-4 py-2.5 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 text-sm">
          <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground shadow-glow">
            <ShieldCheck className="h-3 w-3" /> Boss Console
          </span>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 font-medium text-primary transition hover:bg-primary/25"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Bot Control Center
          </Link>
          <Link
            to="/portals"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 font-medium text-foreground/80 transition hover:bg-card"
          >
            <Music2 className="h-3.5 w-3.5" /> Music Hub Portal
          </Link>
          <a
            href="/auth"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 font-medium text-foreground/80 transition hover:bg-card"
          >
            <Globe2 className="h-3.5 w-3.5" /> Public Sales View
          </a>
        </div>
      </div>
    </div>
  );
}
