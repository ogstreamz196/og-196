import type { ReactNode } from "react";
import { useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { Search, ShieldCheck, LogOut, Crown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminEditModeProvider,
  AdminEditModeToggle,
  useAdminEditMode,
} from "@/components/admin/AdminEditMode";
import { CoinBalance } from "@/components/dashboard/CoinBalance";
import { useAuth } from "@/hooks/use-auth";
import { useDevMode } from "@/hooks/use-dev-mode";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "./AppSidebar";
import { HighContrastToggle } from "./HighContrastToggle";
import { WelcomeBackdrop } from "./WelcomeBackdrop";
// OgFloatingWidget intentionally not imported — see comment below near <main>.
import ogStreamzLogo from "@/assets/ogstreamz-logo.jpg.asset.json";
import ogBotLogo from "@/assets/ogbot.png.asset.json";

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1 shadow-sm backdrop-blur-md"
      aria-label="OG Streamz powered by OG Bot"
    >
      <img
        src={ogStreamzLogo.url}
        alt="OG Streamz"
        className={`${compact ? "h-6" : "h-7"} w-auto rounded-md object-contain`}
      />
      <span className="whitespace-nowrap text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground leading-tight">
        Powered by
      </span>
      <img
        src={ogBotLogo.url}
        alt="OG Bot"
        className={`${compact ? "h-6 w-6" : "h-7 w-7"} rounded-full object-cover ring-1 ring-primary/40`}
      />
    </div>
  );
}

const routeTitles: Record<string, string> = {
  "/": "Home",
  "/library": "MusicHUB",
  "/messenger": "OG Messenger",
  "/portals": "Portals",
  "/buy-coins": "Buy Coins",
  "/settings": "Settings",
  "/admin": "Admin Controls",
};

function getRouteTitle(pathname: string) {
  const match = Object.keys(routeTitles)
    .filter((path) =>
      path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/"),
    )
    .sort((a, b) => b.length - a.length)[0];
  return match ? routeTitles[match] : "PORTAL";
}

function AdminEditHint() {
  const { enabled } = useAdminEditMode();
  if (!enabled) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
      <ShieldCheck className="h-3.5 w-3.5" />
      Edit mode is on.
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = getRouteTitle(pathname);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const dev = useDevMode();
  const { isAdmin, isVip, isLoading: roleLoading } = useRole();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/welcome", replace: true });
  }

  return (
    <AdminEditModeProvider>
      <SidebarProvider>
        <WelcomeBackdrop />
        <div className="relative flex min-h-dvh w-full bg-background/80 text-foreground">
          <AppSidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/8 bg-background/70 px-3 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-5 lg:px-7">
              <SidebarTrigger className="shrink-0" />

              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <BrandLockup compact />
                <div className="hidden min-w-0 sm:block">
                  <h1 className="font-display truncate text-base font-black leading-tight tracking-tight text-gradient-brand sm:text-xl lg:text-2xl">
                    {title}
                  </h1>
                </div>
                <div className="relative ml-2 hidden w-full max-w-xs lg:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search songs"
                    className="h-9 border-white/10 bg-white/5 pl-9"
                    onChange={(event) => {
                      window.dispatchEvent(
                        new CustomEvent("sonix:search", { detail: event.target.value }),
                      );
                    }}
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                {!roleLoading && isAdmin && (
                  <div className="hidden items-center gap-1.5 rounded-full border border-primary/40 bg-gradient-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow md:flex">
                    <ShieldCheck className="h-3 w-3" />
                    Boss
                  </div>
                )}
                {!roleLoading && isVip && (
                  <Link
                    to="/settings"
                    title="VIP membership — manage subscription"
                    className="hidden items-center gap-1.5 rounded-full border border-primary/40 bg-gradient-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow hover:opacity-90 md:flex"
                  >
                    <Crown className="h-3 w-3" />
                    VIP
                  </Link>
                )}
                <AdminEditModeToggle className="hidden md:inline-flex" />
                <HighContrastToggle />
                <CoinBalance />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  title={dev.isDev ? "Sign out (Dev mode)" : `Sign out${user?.email ? ` ${user.email}` : ""}`}
                  className="h-9 w-9 hover:bg-white/5"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Sign out</span>
                </Button>
              </div>
            </header>

            {!roleLoading && isAdmin && (
              <div className="flex items-center justify-center gap-2 border-b border-primary/40 bg-gradient-brand px-4 py-1.5 text-xs font-semibold uppercase text-primary-foreground shadow-glow">
                <ShieldCheck className="h-3.5 w-3.5" />
                Boss mode active
              </div>
            )}
            <AdminEditHint />

            <main className="min-w-0 flex-1 overflow-x-hidden">
              <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                {children}
              </div>
            </main>

            {/* OG chat lives in <OgBotWidget /> mounted by _authenticated/route.tsx.
                The legacy <OgFloatingWidget /> was a UI-only scaffold and caused a
                duplicate "failing to load" orb on every page. */}
          </div>
        </div>
      </SidebarProvider>
    </AdminEditModeProvider>
  );
}
