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
        "group flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 " +
        (primary
          ? "border-primary/40 shadow-glow hover:border-primary/60"
          : "border-border hover:border-primary/30")
      }
    >
      <div
        className={
          "grid h-12 w-12 place-items-center rounded-xl " +
          (primary ? "bg-gradient-brand shadow-glow" : "bg-gradient-brand-soft")
        }
      >
        <span className={primary ? "text-primary-foreground" : "text-primary"}>{icon}</span>
      </div>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="mt-auto pt-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          {cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
