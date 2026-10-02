import { Link, useRouterState } from "@tanstack/react-router";
import {
  ShieldCheck,
  Globe2,
  Radio,
  Users,
  Scale,
  Activity,
  Store,
  Bot,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/admin", label: "Overview", icon: ShieldCheck },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/system", label: "System", icon: Activity },
  { to: "/admin/audit", label: "Audit", icon: Scale },
  { to: "/admin/store", label: "Store", icon: Store },
  { to: "/admin/og-persona", label: "Persona", icon: Bot },
  { to: "/admin/onboarding", label: "Onboarding", icon: Rocket },
  { to: "/developer", label: "Live users", icon: Radio },
] as const;

/**
 * Boss header + underline tab bar shared by every admin page.
 */
export function BossNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="boss-ui mb-5 space-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 leading-none">
          <p className="truncate text-xl font-bold uppercase tracking-wide">Boss</p>
          <p className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Control panel
          </p>
        </div>
      </div>
      <nav className="sticky top-16 z-10 rounded-xl border border-border bg-card/90 backdrop-blur">
        <div className="flex items-stretch overflow-x-auto whitespace-nowrap px-1 text-sm [scrollbar-width:none]">
          {LINKS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to === "/admin" && pathname === "/admin/");
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3.5 py-3 font-normal transition",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </Link>
            );
          })}
          <a
            href="/auth"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 border-b-2 border-transparent px-3.5 py-3 text-muted-foreground transition hover:text-foreground"
          >
            <Globe2 className="h-3.5 w-3.5" /> Public view
          </a>
        </div>
      </nav>
    </div>
  );
}
