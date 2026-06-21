import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Music2,
  MessageSquareMore,
  Sparkles,
  Coins,
  ArrowRight,
  Plus,
  Wand2,
  Library,
  Headphones,
  CheckCircle2,
  Circle,
  Disc3,
  Mic2,
  Radio,
  Bot,
  AudioLines,
} from "lucide-react";
import { useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDevMode } from "@/hooks/use-dev-mode";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { useRecentSongs, type RecentSong } from "@/hooks/use-recent-songs";
import { useAdaptiveOverlay } from "@/hooks/use-adaptive-overlay";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const dev = useDevMode();
  const { data: profile } = useProfile();
  const { isVip } = useRole();
  const { data: recentSongs = [], isLoading: songsLoading } = useRecentSongs(user?.id);

  const displayName = dev.isDev
    ? "Developer"
    : (profile?.display_name?.trim() || user?.email?.split("@")[0] || "there");
  const balance = profile?.coin_balance ?? 0;
  const hasSongs = recentSongs.length > 0;
  const welcomeRef = useRef<HTMLElement | null>(null);
  const scrimOpacity = useAdaptiveOverlay(welcomeRef, { min: 0.55, max: 0.92 });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      {/* Welcome */}
      <section
        ref={welcomeRef}
        className="relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-card/55 p-6 shadow-card backdrop-blur-2xl sm:p-8"
      >
        {/* Adaptive dark scrim */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-background transition-opacity duration-500"
          style={{ opacity: scrimOpacity }}
        />
        {/* Bottom-up readability gradient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/70 to-background/30"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.55_0.22_268/0.22),transparent_60%)]" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 rounded-2xl bg-background/35 p-4 backdrop-blur-md ring-1 ring-white/10 sm:p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground sm:text-base">
              Welcome back
            </p>
            <h1 className="font-display mt-3 text-5xl font-light leading-[1.05] tracking-[-0.02em] text-foreground [overflow-wrap:anywhere] [text-shadow:0_2px_24px_rgba(0,0,0,0.75)] sm:text-7xl">
              Hello, <em className="italic text-gradient-brand [overflow-wrap:anywhere]">{displayName}</em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-foreground/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)] sm:text-xl">
              Jump back into your music workspace or pick up a conversation with OG Messenger.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-base">
            {isVip && (
              <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
                <Sparkles className="h-4 w-4" /> VIP
              </Badge>
            )}
            <Badge variant="outline" className="gap-2 border-white/15 bg-white/5 px-3 py-1.5 text-sm">
              <Coins className="h-4 w-4 text-primary" />
              {balance} coins
            </Badge>
          </div>
        </div>
      </section>

      {/* Primary CTAs */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PrimaryCard
          to="/library"
          icon={<Music2 className="h-5 w-5" />}
          eyebrow="Music Hub"
          title="Create a song"
          body="Generate, refine and remix tracks tailored to your taste with the OG engine."
          cta="Open Music Hub"
        />
        <PrimaryCard
          to="/messenger"
          icon={<MessageSquareMore className="h-5 w-5" />}
          eyebrow="OG Messenger"
          title="Chat to OG Bot"
          body="Talk to your AI co-producer, brainstorm lyrics, or just shoot the breeze."
          cta="Open Messenger"
          variant="accent"
        />

      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-4 text-sm uppercase tracking-[0.24em] text-muted-foreground sm:text-base">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction to="/library" icon={<Plus className="h-5 w-5" />} label="New song" />
          <QuickAction to="/library" icon={<Library className="h-5 w-5" />} label="My library" />
          <QuickAction to="/messenger" icon={<Wand2 className="h-5 w-5" />} label="Ask OG" />
          <QuickAction to="/buy-coins" icon={<Coins className="h-5 w-5" />} label="Buy coins" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Recent songs</CardTitle>
              <CardDescription className="text-base">Pick up where you left off.</CardDescription>
            </div>
            <Link
              to="/library"
              preload="intent"
              className={cn(buttonVariants({ variant: "ghost", size: "default" }), "gap-1.5 text-base")}
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {songsLoading ? (
              <RecentSkeleton />
            ) : hasSongs ? (
              <ul className="divide-y divide-border">
                {recentSongs.slice(0, 5).map((s) => (
                  <RecentRow key={s.id} song={s} />
                ))}
              </ul>
            ) : (
              <EmptyRecent />
            )}
          </CardContent>
        </Card>

        {/* Next steps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Next steps</CardTitle>
            <CardDescription className="text-base">Get the most out of OG Studio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChecklistItem
              done={!!profile?.display_name}
              label="Complete your profile"
              to="/settings"
            />
            <ChecklistItem done={hasSongs} label="Create your first song" to="/library" />
            <ChecklistItem done={false} label="Say hi in OG Messenger" to="/messenger" />
            <ChecklistItem done={isVip} label="Unlock VIP perks" to="/buy-coins" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PrimaryCard({
  to,
  icon,
  eyebrow,
  title,
  body,
  cta,
  variant = "primary",
}: {
  to: "/library" | "/messenger";
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  variant?: "primary" | "accent";
}) {
  const isAccent = variant === "accent";
  return (
    <Link
      to={to}
      preload="intent"
      className="group relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-card/70 p-7 shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow sm:min-h-[440px]"
    >
      {/* Ambient gradient layers */}
      <div
        className={
          "pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-500 group-hover:opacity-100 " +
          (isAccent
            ? "bg-[radial-gradient(circle_at_top_right,oklch(0.65_0.18_310/0.28),transparent_55%),radial-gradient(circle_at_bottom_left,oklch(0.55_0.22_268/0.22),transparent_60%)]"
            : "bg-[radial-gradient(circle_at_top_right,oklch(0.55_0.22_268/0.32),transparent_55%),radial-gradient(circle_at_bottom_left,oklch(0.65_0.18_200/0.18),transparent_60%)]")
        }
      />
      {/* Decorative graphic right side */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl transition-transform duration-700 group-hover:scale-110" />
      <div className="pointer-events-none absolute right-4 top-6 opacity-[0.07] transition-all duration-700 group-hover:rotate-12 group-hover:opacity-[0.14] sm:right-8 sm:top-10">
        {isAccent ? (
          <Bot className="h-48 w-48 sm:h-64 sm:w-64" strokeWidth={1.25} />
        ) : (
          <Disc3 className="h-48 w-48 animate-[spin_18s_linear_infinite] sm:h-64 sm:w-64" strokeWidth={1.25} />
        )}
      </div>
      {/* Equalizer bars bottom-right accent */}
      <div className="pointer-events-none absolute bottom-6 right-6 flex items-end gap-1 opacity-40 transition-opacity duration-300 group-hover:opacity-90">
        {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.45].map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-primary/60 to-primary"
            style={{
              height: `${h * 36}px`,
              animation: `eqPulse 1.${(i % 6) + 2}s ease-in-out ${i * 0.1}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-1 flex-col">
        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-gradient-brand-soft text-primary shadow-glow">
          {icon}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
          <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        </div>
        <h3 className="font-display mt-3 text-[clamp(2.25rem,6.5vw,4.25rem)] font-black uppercase leading-[0.9] tracking-[-0.035em] drop-shadow-[0_6px_24px_rgba(80,60,255,0.35)]">
          {title.split(" ").map((word, i, arr) => {
            const isLast = i === arr.length - 1;
            return (
              <span
                key={`${word}-${i}`}
                className={
                  "wc-pop block " +
                  (isLast ? "italic text-gradient-brand wc-bounce-soft" : "")
                }
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                {word}
                {isLast ? "." : ""}
              </span>
            );
          })}
        </h3>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>

        {/* Feature chips */}
        <div className="mt-5 flex flex-wrap gap-2">
          {(isAccent
            ? [
                { icon: <Sparkles className="h-3 w-3" />, label: "AI co-producer" },
                { icon: <MessageSquareMore className="h-3 w-3" />, label: "Lyric brainstorm" },
                { icon: <Wand2 className="h-3 w-3" />, label: "Voice ideas" },
              ]
            : [
                { icon: <Mic2 className="h-3 w-3" />, label: "Lyrics" },
                { icon: <AudioLines className="h-3 w-3" />, label: "Beats" },
                { icon: <Radio className="h-3 w-3" />, label: "Remix" },
              ]
          ).map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-foreground/80 backdrop-blur-sm"
            >
              {chip.icon}
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 backdrop-blur-sm transition-colors group-hover:bg-primary/20">
          {cta}
        </span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function QuickAction({
  to,
  icon,
  label,
}: {
  to: "/library" | "/messenger" | "/buy-coins";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group flex h-auto items-center justify-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/[0.06] hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-brand-soft text-primary transition-transform duration-200 group-hover:scale-110">
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function RecentRow({ song }: { song: RecentSong }) {
  const title = song.title?.trim() || song.prompt?.slice(0, 60) || "Untitled";
  return (
    <li>
      <Link
        to="/library/$songId"
        params={{ songId: song.id }}
        className="group flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-white/[0.04]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-gradient-brand-soft shadow-card">
          {song.cover_url ? (
            <img
              src={song.cover_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          ) : (
            <Headphones className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {new Date(song.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 border-white/10 bg-white/[0.04] text-xs capitalize">
          {song.status}
        </Badge>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </li>
  );
}

function RecentSkeleton() {
  return (
    <ul className="divide-y divide-border/40">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-3">
          <div className="h-11 w-11 animate-pulse rounded-lg bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
            <div className="h-2 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyRecent() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-white/15 bg-gradient-brand-soft text-primary">
        <Music2 className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold">No songs yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Generate your first personalised track in Music Hub.
        </p>
      </div>
      <Link
        to="/library"
        className={cn(buttonVariants({ size: "sm", variant: "premium" }), "mt-2 rounded-full")}
      >
        Create a song
      </Link>
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  to,
}: {
  done: boolean;
  label: string;
  to: "/library" | "/messenger" | "/settings" | "/buy-coins";
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40"
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-primary" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={"text-sm " + (done ? "text-muted-foreground line-through" : "")}>
        {label}
      </span>
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}
