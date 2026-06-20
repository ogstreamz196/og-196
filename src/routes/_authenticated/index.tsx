import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Library, Coins, Compass, Music2, Sparkles, ArrowRight, Loader2, Crown, ShieldCheck,
  MessageCircle, Zap,
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

  const balance = profile?.coin_balance ?? 0;

  return (
    <DashboardShell title="OG Streamz">
      <div className="mx-auto max-w-6xl space-y-10">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card bg-gradient-hero md:p-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            <EditableContent contentKey="dashboard.welcome.eyebrow" defaultValue="OG Streamz · powered by OG Bot" />
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
            {isAdmin ? (
              <>Welcome back, <span className="text-gradient-brand">Boss</span> 👑</>
            ) : profile?.display_name ? (
              <>Welcome to the <span className="text-gradient-brand">OG Bot Music Hub</span>, {profile.display_name}</>
            ) : (
              <>The <span className="text-gradient-brand">OG Bot Music Hub</span></>
            )}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground md:text-lg">
            <EditableContent
              contentKey="dashboard.welcome.subtitle"
              defaultValue="Stream, generate and chat — the OG way. Every signed-in user gets 5 free credits to spend on OG Messenger. Each message costs 1 credit."
              multiline
            />
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-coin/40 bg-coin/10 px-2.5 py-1 text-xs font-medium text-coin">
              <Coins className="h-3.5 w-3.5" /> {balance} OG coins
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Zap className="h-3.5 w-3.5" /> 1 credit / message
            </span>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3 w-3" /> Boss
              </span>
            )}
            {isVip && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
                <Crown className="h-3 w-3" /> VIP
              </span>
            )}
          </div>
        </section>

        {/* The two main highlights */}
        <section className="grid gap-5 md:grid-cols-2">
          <HighlightCard
            to="/portals"
            badge="Music Hub"
            title="OG Bot Music Hub"
            description="Browse portals, drop into your library, and generate new tracks with the OG Bot."
            icon={<Music2 className="h-6 w-6" />}
            cta="Enter the Hub"
            footer={`${songCountQ.data ?? 0} songs in your library`}
            primary
          />
          <HighlightCard
            to="/messenger"
            badge="OG Messenger"
            title="Chat with OG Bot"
            description="Real-time conversations with the OG Bot. Free to start — every signed-in user gets 5 credits, 1 per message."
            icon={<MessageCircle className="h-6 w-6" />}
            cta="Open Messenger"
            footer={`${balance} credits available`}
          />
        </section>

        {/* Stat strip */}
        <section className="grid gap-4 sm:grid-cols-3">
          <MiniStat to="/library" icon={<Library className="h-4 w-4" />} label="Your library" value={songCountQ.isLoading ? "—" : String(songCountQ.data ?? 0)} />
          <MiniStat to="/buy-coins" icon={<Coins className="h-4 w-4 text-coin" />} label="OG coins" value={String(balance)} cta="Top up" />
          <MiniStat to="/portals" icon={<Compass className="h-4 w-4" />} label="Active portals" value={portalsQ.isLoading ? "—" : String(portalsQ.data?.length ?? 0)} />
        </section>

        {/* Portals grid */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Compass className="h-5 w-5 text-primary" />
              <EditableContent contentKey="dashboard.portals.heading" defaultValue="Featured portals" />
            </h3>
            <Link to="/portals" className="text-sm text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>

          {portalsQ.isLoading ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !portalsQ.data || portalsQ.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
              No portals are active right now. Check back soon.
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

interface HighlightCardProps {
  to: "/portals" | "/messenger";
  badge: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  cta: string;
  footer: string;
  primary?: boolean;
}

function HighlightCard({ to, badge, title, description, icon, cta, footer, primary }: HighlightCardProps) {
  return (
    <Link
      to={to}
      className={
        "group relative flex flex-col overflow-hidden rounded-3xl border bg-card p-7 shadow-card transition-all hover:-translate-y-1 " +
        (primary ? "border-primary/50 shadow-glow" : "border-border hover:border-primary/40")
      }
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-2.5 py-1 text-xs uppercase tracking-wide text-muted-foreground">
          {icon} {badge}
        </span>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>
      <h3 className="mt-5 text-2xl font-bold">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="font-medium text-primary">{cta} →</span>
        <span className="text-xs text-muted-foreground">{footer}</span>
      </div>
    </Link>
  );
}

interface MiniStatProps {
  to: "/library" | "/buy-coins" | "/portals";
  icon: React.ReactNode;
  label: string;
  value: string;
  cta?: string;
}

function MiniStat({ to, icon, label, value, cta }: MiniStatProps) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card transition hover:border-primary/40"
    >
      <div>
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      </div>
      {cta && (
        <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {cta} →
        </span>
      )}
    </Link>
  );
}
