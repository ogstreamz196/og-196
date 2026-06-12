import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Library, Coins as CoinsIcon, LogOut, Music2, Settings, Search, Clock, Loader2, Compass, UserCog, LayoutDashboard, PlusSquare, ShieldCheck, Bot, MessageCircle, Code2 } from "lucide-react";
import { OgBotWidget } from "@/components/messenger/OgBotWidget";
import { useEffect, type ReactNode } from "react";
import { CoinBalance } from "./CoinBalance";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { AdminEditModeProvider, AdminEditModeToggle, useAdminEditMode } from "@/components/admin/AdminEditMode";

function BossEditHint() {
  const { enabled } = useAdminEditMode();
  if (!enabled) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-primary/30 bg-primary/10 px-4 py-1.5 text-[11px] font-medium text-primary">
      <ShieldCheck className="h-3.5 w-3.5" />
      Edit mode is on — click any dashed-underlined heading, label, or description to update it for everyone.
    </div>
  );
}

type NavItem = { to: string; label: string; icon: typeof Library; match?: string[] };

const baseNavItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/portals", label: "Portals", icon: Compass, match: ["/portals", "/portal/"] },
  { to: "/library", label: "My Library", icon: Library, match: ["/library"] },
  { to: "/messenger", label: "OG Messenger", icon: MessageCircle, match: ["/messenger"] },
  { to: "/developer", label: "Developer Center", icon: Code2, match: ["/developer"] },
  { to: "/buy-coins", label: "Buy OG Coins", icon: CoinsIcon, match: ["/buy-coins"] },
];

const vipNavItem: NavItem = { to: "/og-bot/connect", label: "OG Bot Portal", icon: Bot, match: ["/og-bot"] };
const bossNavItem: NavItem = { to: "/admin", label: "Boss Panel", icon: ShieldCheck, match: ["/admin"] };


interface RecentSong {
  id: string;
  title: string | null;
  prompt: string;
  status: string;
  cover_url: string | null;
}

function RecentMedia({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["recent-songs", userId],
    queryFn: async (): Promise<RecentSong[]> => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, prompt, status, cover_url")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as RecentSong[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`sidebar-songs:${userId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "songs", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["recent-songs", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return (
    <div className="mt-6 flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        <Clock className="h-3.5 w-3.5" />
        Recent
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="grid place-items-center py-6 text-sidebar-foreground/40">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : data && data.length > 0 ? (
          data.map((s) => {
            const label = s.title?.trim() || s.prompt?.slice(0, 40) || "Untitled";
            return (
              <Link
                key={s.id}
                to="/library"
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                title={label}
              >
                <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-sidebar-accent/50">
                  {s.cover_url ? (
                    <img src={s.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Music2 className="h-3.5 w-3.5 text-sidebar-foreground/50" />
                  )}
                </div>
                <span className="truncate">{label}</span>
              </Link>
            );
          })
        ) : (
          <p className="px-3 py-2 text-xs text-sidebar-foreground/40">No tracks yet.</p>
        )}
      </div>
    </div>
  );
}

const adminItems: NavItem[] = [
  { to: "/admin", label: "Boss Panel", icon: ShieldCheck, match: ["/admin"] },
  { to: "/admin/users", label: "Manage Users", icon: UserCog, match: ["/admin/users"] },
  { to: "/admin/og-bot", label: "OG Bot Tokens", icon: Bot, match: ["/admin/og-bot"] },
  { to: "/admin/og-persona", label: "OG Bot Persona", icon: MessageCircle, match: ["/admin/og-persona"] },
  { to: "/admin/create-portal", label: "New Portal", icon: PlusSquare, match: ["/admin/create-portal"] },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/";
  if (item.match) {
    return item.match.some((m) => pathname === m || pathname.startsWith(m + "/") || pathname.startsWith(m));
  }
  return pathname === item.to;
}

export function DashboardShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useRole();
  const qc = useQueryClient();


  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AdminEditModeProvider>
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-4">
        <Link to="/" className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Music2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">Sonix</span>
        </Link>

        <nav className="mt-6 flex flex-col gap-1">
          {[...baseNavItems, ...(!roleLoading && isAdmin ? [bossNavItem] : [])].map((item) => {
            const active = isItemActive(item, pathname);
            const Icon = item.icon;
            const isBoss = item.to === "/admin";
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isBoss && "mt-2 border border-primary/30 bg-gradient-brand-soft",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4", (active || isBoss) && "text-primary")} />
                {item.label}
                {isBoss && (
                  <span className="ml-auto rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                    Boss
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {user ? <RecentMedia userId={user.id} /> : <div className="flex-1" />}

        <div className="mt-4 space-y-1 border-t border-sidebar-border pt-4">
          <div className="px-3 py-1 text-xs text-sidebar-foreground/50 truncate">
            {user?.email}
          </div>
          <Link
            to="/settings"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === "/settings"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
          <h1 className="shrink-0 text-lg font-semibold">{title}</h1>
          <div className="relative ml-auto hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search songs..."
              className="pl-9"
              onChange={(e) => {
                const v = e.target.value;
                window.dispatchEvent(new CustomEvent("sonix:search", { detail: v }));
              }}
            />
          </div>
          {!roleLoading && isAdmin && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-primary/40 bg-gradient-brand px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary-foreground shadow-glow">
              <ShieldCheck className="h-3.5 w-3.5" />
              Boss
            </div>
          )}
          <AdminEditModeToggle />
          <CoinBalance />
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-sidebar/50 px-2 py-2 md:hidden">
          {[...baseNavItems, ...(!roleLoading && isAdmin ? [bossNavItem] : [])].map((item) => {
            const active = isItemActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {!roleLoading && isAdmin && (
          <div className="flex items-center justify-center gap-2 border-b border-primary/40 bg-gradient-brand px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground shadow-glow">
            <ShieldCheck className="h-3.5 w-3.5" />
            Boss mode active — signed in as {user?.email}
          </div>
        )}
        {isAdmin && <BossEditHint />}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
      <OgBotWidget />
    </div>
    </AdminEditModeProvider>
  );
}
