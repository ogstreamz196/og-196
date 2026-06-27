import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export interface HubCardProps {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
  cta: string;
  primary?: boolean;
}

export function HubCard({ to, icon, title, description, cta, primary }: HubCardProps) {
  return (
    <Link
      to={to}
      className={
        "group relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card/70 p-6 shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
        (primary
          ? "border-primary/40 shadow-glow hover:border-primary/60 hover:shadow-[0_24px_80px_-20px_oklch(0.55_0.22_268/0.65)]"
          : "border-white/10 hover:border-primary/40 hover:shadow-glow")
      }
    >
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_top_right,oklch(0.55_0.22_268/0.18),transparent_60%)]" />
      <div
        className={
          "grid h-12 w-12 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 " +
          (primary ? "bg-gradient-brand shadow-glow" : "bg-gradient-brand-soft")
        }
      >
        <span className={primary ? "text-primary-foreground" : "text-primary"}>{icon}</span>
      </div>
      <div className="min-w-0">
        <h3 className="font-bitcount text-4xl font-black leading-none tracking-tight sm:text-5xl md:text-6xl">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
      </div>
      <div className="mt-auto pt-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          {cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
