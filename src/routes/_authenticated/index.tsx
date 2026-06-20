import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Music2, Sparkles, ArrowRight, Crown, ShieldCheck,
  Coins, Zap, Headphones, Mic2, Radio, Library, Compass,
  Bot, Play, Wand2, MessageCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardHome,
});

interface RecentSong {
  id: string;
  title: string | null;
  prompt: string;
  status: string;
  cover_url: string | null;
  created_at: string;
}

function useRecentSongs(userId: string | undefined) {
  return useQuery({
    queryKey: ["recent-songs-home", userId],
    enabled: !!userId,
    queryFn: async (): Promise<RecentSong[]> => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, prompt, status, cover_url, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as RecentSong[];
    },
  });
}

export default function DashboardHome() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { isAdmin, isVip } = useRole();
  const recentQuery = useRecentSongs(user?.id);

  const balance = profile?.coin_balance ?? 0;

  return (
    <DashboardShell title="Music Hub">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        {/* HERO — Music Hub powered by OG Bot */}
        <section className="relative w-full overflow-hidden rounded-3xl border border-border bg-card p-10 text-center shadow-card bg-gradient-hero md:p-16">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            OG Streamz — powered by OG Bot
          </div>

          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl">
            <span className="text-gradient-brand">OG Bot</span>
            <br className="hidden md:block" />
            <span className="text-gradient-metal"> Music Hub</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Generate, stream, and manage your tracks — all in one place.
            OG Bot is your AI studio co-pilot: describe an idea, pick a portal, and watch it come to life.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/portals"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              <Wand2 className="h-4 w-4" /> Start Creating
            </Link>
            <Link
              to="/library"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-7 py-3 text-sm font-semibold text-foreground backdrop-blur transition hover:border-primary/40"
            >
              <Library className="h-4 w-4" /> My Library
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-coin/40 bg-coin/10 px-3 py-1.5 text-sm font-medium text-coin">
              <Coins className="h-4 w-4" /> {balance} OG coins
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <Zap className="h-4 w-4" /> 1 coin / track
            </span>
            {isAdmin && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                <ShieldCheck className="h-4 w-4" /> Boss
              </span>
            )}
            {isVip && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-500">
                <Crown className="h-4 w-4" /> VIP
              </span>
            )}
          </div>
        </section>

        {/* FEATURE GRID — what the hub does */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand-soft">
              <Music2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">What you can do</h2>
              <p className="text-sm text-muted-foreground">Everything you need to create and collect music.</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <HubCard
              to="/portals"
              icon={<Compass className="h-6 w-6" />}
              title="Browse Portals"
              description="Explore curated music portals. Each one is a unique AI engine tuned to a genre or style."
              cta="Explore"
              primary
            />
            <HubCard
              to="/portals"
              icon={<Wand2 className="h-6 w-6" />}
              title="Generate Tracks"
              description="Describe your idea, pick a portal, and let OG Bot compose your next hit in seconds."
              cta="Create"
            />
            <HubCard
              to="/library"
              icon={<Library className="h-6 w-6" />}
              title="Your Library"
              description="Every track you generate lives here. Stream, review, and build your personal catalog."
              cta="Open Library"
            />
            <HubCard
              to="/messenger"
              icon={<MessageCircle className="h-6 w-6" />}
              title="OG Messenger"
              description="Chat with OG Bot for tips, recommendations, and production advice. 5 free credits on sign-up."
              cta="Chat"
            />
          </div>
        </section>

        {/* OG BOT ENGINE HIGHLIGHT */}
        <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-brand-soft p-10 shadow-glow md:p-14">
          <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
                <Bot className="h-3.5 w-3.5" /> OG Bot Engine
              </div>
              <h2 className="mt-4 text-3xl font-bold md:text-4xl">The brain behind every beat</h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                OG Bot doesn't just generate audio — it understands style, mood, and structure.
                From the flagship Song Studio to custom portals, every track is shaped by AI that thinks like a producer.
              </p>
            </div>
            <Link
              to="/portals"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              <Play className="h-4 w-4" /> Enter Song Studio
            </Link>
          </div>
        </section>

        {/* RECENT CREATIONS */}
        {recentQuery.data && recentQuery.data.length > 0 && (
          <section>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand-soft">
                  <Headphones className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Recent creations</h2>
                  <p className="text-sm text-muted-foreground">Your latest tracks from across the hub.</p>
                </div>
              </div>
              <Link
                to="/library"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all →
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentQuery.data.map((song) => (
                <Link
                  key={song.id}
                  to="/library/$songId"
                  params={{ songId: song.id }}
                  className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30"
                >
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-brand-soft">
                    {song.cover_url ? (
                      <img src={song.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Music2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">{song.title?.trim() || "Untitled"}</h3>
                    <p className="truncate text-xs text-muted-foreground">{song.prompt.slice(0, 60)}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Zap className="h-3 w-3" /> {song.status}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* OG BOT PORTAL / VIP CTA */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand shadow-glow">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold">OG Bot Portal</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Mint API tokens and drop the OG Bot widget onto your own website.
              Bring the Music Hub experience to any domain you own.
            </p>
            <Link
              to="/og-bot/connect"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/40"
            >
              <Bot className="h-4 w-4" /> Connect Portal <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20">
                <Crown className="h-5 w-5 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold">OG VIP</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Priority generation, exclusive badges, and VIP-only portal access.
              Unlock the full power of the Music Hub.
            </p>
            <Link
              to="/buy-coins"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-amber-950 transition hover:opacity-90"
            >
              <Crown className="h-4 w-4" /> Go VIP <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* COINS CTA */}
        <section className="w-full rounded-2xl border border-border bg-card/60 p-8 text-center shadow-card">
          <h3 className="text-xl font-semibold">Running low on coins?</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Top up your OG coins to keep creating. Choose from coin packs or grab a VIP membership for unlimited perks.
          </p>
          <Link
            to="/buy-coins"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Coins className="h-4 w-4" /> Buy Coins & VIP
          </Link>
        </section>
      </div>
    </DashboardShell>
  );
}

interface HubCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  primary?: boolean;
}

function HubCard({ to, icon, title, description, cta, primary }: HubCardProps) {
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
