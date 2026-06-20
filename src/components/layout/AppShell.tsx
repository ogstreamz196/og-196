import type { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, ShieldCheck, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminEditModeProvider, AdminEditModeToggle, useAdminEditMode } from "@/components/admin/AdminEditMode";
import { CoinBalance } from "@/components/dashboard/CoinBalance";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "./AppSidebar";
import { OgFloatingWidget } from "@/components/og-widget/OgFloatingWidget";

const routeTitles: Record<string, string> = {
  "/": "Music Hub",
  "/library": "Music Hub",
  "/messenger": "OG Messenger",
  "/portals": "Portals",
  "/buy-coins": "Buy Coins",
  "/settings": "Settings",
  "/developer": "Developer",
  "/admin": "Admin",
};

function getRouteTitle(pathname: string) {
  const match = Object.keys(routeTitles)
    .filter((path) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/")))
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
  const { isAdmin, isLoading: roleLoading } = useRole();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AdminEditModeProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background text-foreground">
          <AppSidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-3 backdrop-blur-xl sm:px-4 lg:px-6">
              <SidebarTrigger className="shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium uppercase text-muted-foreground">OG Streamz</p>
                <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">{title}</h1>
              </div>

              <div className="relative ml-auto hidden w-full max-w-sm sm:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search songs"
                  className="h-9 bg-card pl-9"
                  onChange={(event) => {
                    window.dispatchEvent(new CustomEvent("sonix:search", { detail: event.target.value }));
                  }}
                />
              </div>

              {!roleLoading && isAdmin && (
                <div className="hidden items-center gap-1.5 rounded-full border border-primary/40 bg-gradient-brand px-3 py-1 text-xs font-bold uppercase text-primary-foreground shadow-glow sm:flex">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Boss
                </div>
              )}
              <AdminEditModeToggle className="hidden sm:inline-flex" />
              <CoinBalance className="hidden sm:inline-flex" />
              <Button type="button" variant="ghost" size="icon" onClick={handleSignOut} title={`Sign out${user?.email ? ` ${user.email}` : ""}`}>
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            </header>

            {!roleLoading && isAdmin && (
              <div className="flex items-center justify-center gap-2 border-b border-primary/40 bg-gradient-brand px-4 py-1.5 text-xs font-semibold uppercase text-primary-foreground shadow-glow">
                <ShieldCheck className="h-3.5 w-3.5" />
                Boss mode active
              </div>
            )}
            <AdminEditHint />

            <main className="min-w-0 flex-1">
              <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">{children}</div>
            </main>

            <OgFloatingWidget />
          </div>
        </div>
      </SidebarProvider>
    </AdminEditModeProvider>
  );
}
