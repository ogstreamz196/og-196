import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Library, Coins, Compass, Music2, Sparkles, ArrowRight, Loader2, Crown, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EditableContent } from "@/components/admin/EditableContent";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardHome,
});

interface PortalRow {
  id: string;
  slug: string;
  name: string;
  language: string;
  primary_color: string | null;
  coin_cost_per_generation: number | null;
}

function DashboardHome() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { isAdmin, isVip } = useRole();

  const songCountQ = useQuery({
    queryKey: ["dash-song-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("songs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const portalsQ = useQuery({
    queryKey: ["dash-portals"],
    queryFn: async (): Promise<PortalRow[]> => {
      const { data, error } = await supabase
        .from("portals")
        .select("id, slug, name, language, primary_color, coin_cost_per_generation")
        .eq("status", "active")
        .order("name")
        .limit(6);
      if (error) throw error;
      return (data ?? []) as PortalRow[];
    },
  });

  return (
    <DashboardShell title="Dashboard">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Welcome */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card bg-gradient-hero">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            <EditableContent contentKey="dashboard.welcome.eyebrow" defaultValue="Powered by 0G-Streamz" />
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            {isAdmin ? (
              <>Welcome back, <span className="text-gradient-brand">Boss</span> 👑</>
            ) : profile?.display_name ? (
              <>Welcome back, <span className="text-gradient-brand">{profile.display_name}</span></>
            ) : (
              <>Welcome to your <span className="text-gradient-brand">studio</span></>
            )}
          </h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            <EditableContent
              contentKey="dashboard.welcome.subtitle"
              defaultValue="Pick a portal to start a new song, browse your library, or top up your coin balance."
              multiline
            />
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <ShieldCheck className="h-3 w-3" /> Boss
              </span>
            )}
            {isVip && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500">
                <Crown className="h-3 w-3" /> VIP
              </span>
            )}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            to="/library"
            icon={<Library className="h-5 w-5" />}
            label="Media created"
            value={songCountQ.isLoading ? "—" : String(songCountQ.data ?? 0)}
            sub="Songs in your library"
            cta="Open library"
          />
          <StatCard
            to="/buy-coins"
            icon={<Coins className="h-5 w-5 text-coin" />}
            label="Coin balance"
            value={String(profile?.coin_balance ?? 0)}
            sub="3 coins per generation"
            cta="Buy more coins"
            highlight
          />
          <StatCard
            to="/portals"
            icon={<Compass className="h-5 w-5" />}
            label="Active portals"
            value={portalsQ.isLoading ? "—" : String(portalsQ.data?.length ?? 0)}
            sub="Curated by the Boss"
            cta="Browse all"
          />
        </div>

        {/* Portals grid */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Compass className="h-5 w-5 text-primary" />
              <EditableContent contentKey="dashboard.portals.heading" defaultValue="Generation portals" />
            </h3>
            <Link to="/portals" className="text-sm text-muted-foreground hover:text-foreground">
              <EditableContent contentKey="dashboard.portals.viewAll" defaultValue="View all" /> <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>

          {portalsQ.isLoading ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !portalsQ.data || portalsQ.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
              <EditableContent
                contentKey="dashboard.portals.empty"
                defaultValue="No portals are active right now. Check back soon."
                multiline
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {portalsQ.data.map((p) => {
                const themeColor = p.primary_color || "hsl(var(--primary))";
                return (
                  <Link
                    key={p.id}
                    to="/portal/$slug"
                    params={{ slug: p.slug }}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-glow"
                    style={{ boxShadow: `0 0 40px -28px ${themeColor}` }}
                  >
                    <div
                      className="grid h-10 w-10 place-items-center rounded-xl text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      <Music2 className="h-5 w-5" />
                    </div>
                    <h4 className="mt-3 text-base font-semibold">{p.name}</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">Lyrics in {p.language}</p>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Coins className="h-3.5 w-3.5 text-coin" />
                        {p.coin_cost_per_generation ?? 3} per generation
                      </span>
                      <span className="text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Open <ArrowRight className="ml-0.5 inline h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

interface StatCardProps {
  to: "/library" | "/buy-coins" | "/portals";
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  cta: string;
  highlight?: boolean;
}

function StatCard({ to, icon, label, value, sub, cta, highlight }: StatCardProps) {
  return (
    <Link
      to={to}
      className={
        "group relative flex flex-col rounded-2xl border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 " +
        (highlight ? "border-primary/50 shadow-glow" : "border-border hover:border-primary/40")
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon} <span className="uppercase tracking-wide">{label}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      <span className="mt-4 inline-flex items-center text-xs font-medium text-primary">
        {cta} <ArrowRight className="ml-1 h-3 w-3" />
      </span>
    </Link>
  );
}
