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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { useRecentSongs, type RecentSong } from "@/hooks/use-recent-songs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { isVip } = useRole();
  const { data: recentSongs = [], isLoading: songsLoading } = useRecentSongs(user?.id);

  const displayName = profile?.display_name?.trim() || user?.email?.split("@")[0] || "there";
  const balance = profile?.coin_balance ?? 0;
  const hasSongs = recentSongs.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      {/* Welcome */}
      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Welcome back
            </p>
            <h1 className="font-display mt-3 text-4xl font-light leading-[1.05] tracking-[-0.02em] sm:text-5xl">
              Hello, <em className="italic text-gradient-brand">{displayName}</em>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Jump back into your music workspace or pick up a conversation with OG Messenger.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            {isVip && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" /> VIP
              </Badge>
            )}
            <Badge variant="outline" className="gap-1.5 border-white/15 bg-white/5">
              <Coins className="h-3.5 w-3.5 text-primary" />
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
          title="Create a personalised song"
          body="Generate, refine and remix tracks tailored to your taste with the OG engine."
          cta="Open Music Hub"
        />
        <PrimaryCard
          to="/messenger"
          icon={<MessageSquareMore className="h-5 w-5" />}
          eyebrow="OG Messenger"
          title="Chat with OG Messenger"
          body="Talk to your AI co-producer, brainstorm lyrics, or just shoot the breeze."
          cta="Open Messenger"
          variant="accent"
        />
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction to="/library" icon={<Plus className="h-4 w-4" />} label="New song" />
          <QuickAction to="/library" icon={<Library className="h-4 w-4" />} label="My library" />
          <QuickAction to="/messenger" icon={<Wand2 className="h-4 w-4" />} label="Ask OG" />
          <QuickAction to="/buy-coins" icon={<Coins className="h-4 w-4" />} label="Buy coins" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent songs</CardTitle>
              <CardDescription>Pick up where you left off.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/library">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
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
            <CardTitle className="text-lg">Next steps</CardTitle>
            <CardDescription>Get the most out of OG Studio.</CardDescription>
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
  return (
    <Link
      to={to}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-card/70 p-7 shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
    >
      <div
        className={
          "pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-500 group-hover:opacity-100 " +
          (variant === "accent"
            ? "bg-[radial-gradient(circle_at_top_right,oklch(0.86_0.012_255/0.18),transparent_60%)]"
            : "bg-[radial-gradient(circle_at_top_right,oklch(0.55_0.22_268/0.22),transparent_60%)]")
        }
      />
      <div className="relative">
        <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-background/40 text-primary">
          {icon}
        </div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        <h3 className="font-display mt-2 text-2xl font-normal tracking-tight">{title}</h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="relative mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        {cta}
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
    <Button asChild variant="outline" className="h-auto justify-start gap-2 py-3">
      <Link to={to}>
        <span className="text-primary">{icon}</span>
        <span className="text-sm">{label}</span>
      </Link>
    </Button>
  );
}

function RecentRow({ song }: { song: RecentSong }) {
  const title = song.title?.trim() || song.prompt?.slice(0, 60) || "Untitled";
  return (
    <li>
      <Link
        to="/library/$songId"
        params={{ songId: song.id }}
        className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/40"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {song.cover_url ? (
            <img
              src={song.cover_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <Headphones className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {new Date(song.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="outline" className="text-xs capitalize">
          {song.status}
        </Badge>
      </Link>
    </li>
  );
}

function RecentSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <div className="h-10 w-10 animate-pulse rounded-md bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyRecent() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
        <Music2 className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium">No songs yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Generate your first personalised track in Music Hub.
        </p>
      </div>
      <Button asChild size="sm" className="mt-1">
        <Link to="/library">Create a song</Link>
      </Button>
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
