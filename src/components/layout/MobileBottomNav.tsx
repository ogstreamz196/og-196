import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Library, MessageCircle, ShoppingBag, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

type Tab = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (path: string) => boolean;
};

const TABS: Tab[] = [
  { to: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  { to: "/library", label: "Music", icon: Library, match: (p) => p.startsWith("/library") },
  { to: "/messenger", label: "OG Bot", icon: MessageCircle, match: (p) => p.startsWith("/messenger") },
  { to: "/store", label: "Store", icon: ShoppingBag, match: (p) => p.startsWith("/store") || p.startsWith("/buy-coins") },
  { to: "/referrals", label: "Earn", icon: Sparkles, match: (p) => p.startsWith("/referrals") },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to} className="contents">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "drop-shadow-[0_0_6px_hsl(var(--primary)/0.7)]" : ""}`}
                  aria-hidden
                />
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
