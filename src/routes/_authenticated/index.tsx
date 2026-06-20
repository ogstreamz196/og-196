import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Music2, MessageCircle, Sparkles, ArrowRight, Crown, ShieldCheck,
  Coins, Zap, Headphones, Mic2, Radio,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { isAdmin, isVip } = useRole();

  const balance = profile?.coin_balance ?? 0;

  return (
    <DashboardShell title="OG Streamz · OG Bot Music Hub">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-10">
        {/* Hero */}
        <section className="relative w-full overflow-hidden rounded-3xl border border-border bg-card p-10 text-center shadow-card bg-gradient-hero md:p-16">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            OG Streamz · powered by OG Bot
          </div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
            {isAdmin ? (
              <>Welcome back, <span className="text-gradient-brand">Boss</span> 👑</>
            ) : profile?.display_name ? (
              <><span className="text-gradient-brand">OG Bot Music Hub</span></>
            ) : (
              <><span className="text-gradient-brand">OG Bot Music Hub</span></>
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            Stream, generate, and chat with OG Bot — the ultimate music experience.
            Every signed-in user gets <strong className="text-foreground">5 free credits</strong> to use on OG Messenger.
            Each message costs <strong className="text-foreground">1 credit</strong>.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-coin/40 bg-coin/10 px-3 py-1.5 text-sm font-medium text-coin">
              <Coins className="h-4 w-4" /> {balance} OG coins
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <Zap className="h-4 w-4" /> 1 credit / message
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

        {/* Two massive feature cards */}
        <section className="grid w-full gap-6 md:grid-cols-2">
          <FeatureCard
            to="/portals"
            badge="Music Hub"
            title="OG Bot Music Hub"
            description="Discover portals, build your library, and generate brand-new tracks with the OG Bot. Your personal music universe."
            icon={<Music2 className="h-8 w-8" />}
            cta="Enter the Hub"
            perks={[
              { icon: <Headphones className="h-4 w-4" />, label: "Stream & listen" },
              { icon: <Mic2 className="h-4 w-4" />, label: "Generate tracks" },
              { icon: <Radio className="h-4 w-4" />, label: "Browse portals" },
            ]}
            primary
          />
          <FeatureCard
            to="/messenger"
            badge="OG Messenger"
            title="Chat with OG Bot"
            description="Real-time conversations with OG Bot. Ask about music, get recommendations, or just vibe. 5 free credits for every user."
            icon={<MessageCircle className="h-8 w-8" />}
            cta="Open Messenger"
            perks={[
              { icon: <Zap className="h-4 w-4" />, label: "1 credit / message" },
              { icon: <Coins className="h-4 w-4" />, label: `${balance} credits left` },
              { icon: <Sparkles className="h-4 w-4" />, label: "AI-powered replies" },
            ]}
          />
        </section>

        {/* Buy more credits teaser */}
        <section className="w-full rounded-2xl border border-border bg-card/60 p-8 text-center shadow-card">
          <h3 className="text-xl font-semibold">Need more credits?</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Top up your OG coins to keep the music flowing. Choose from coin packs or go VIP for unlimited perks.
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

interface Perk {
  icon: React.ReactNode;
  label: string;
}

interface FeatureCardProps {
  to: "/portals" | "/messenger";
  badge: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  cta: string;
  perks: Perk[];
  primary?: boolean;
}

function FeatureCard({ to, badge, title, description, icon, cta, perks, primary }: FeatureCardProps) {
  return (
    <Link
      to={to}
      className={
        "group relative flex flex-col overflow-hidden rounded-3xl border bg-card p-8 shadow-card transition-all hover:-translate-y-1 md:p-10 " +
        (primary
          ? "border-primary/50 shadow-glow"
          : "border-border hover:border-primary/40")
      }
    >
      <div className="flex items-center justify-between">
        <span
          className={
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs uppercase tracking-wide " +
            (primary
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-background/50 text-muted-foreground")
          }
        >
          {icon} {badge}
        </span>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>

      <h2 className="mt-8 text-3xl font-bold md:text-4xl">{title}</h2>
      <p className="mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">{description}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        {perks.map((perk, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs text-muted-foreground"
          >
            {perk.icon} {perk.label}
          </span>
        ))}
      </div>

      <div className="mt-10">
        <span
          className={
            "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition " +
            (primary
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "border border-border bg-background/60 text-foreground hover:border-primary/40")
          }
        >
          {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
