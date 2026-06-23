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

type PromptIdea = { title: string; description: string; vibe: string };

const EXAMPLE_PROMPTS: PromptIdea[] = [
  { title: "Late night drive", description: "Synthwave with moody vocals and neon city energy.", vibe: "Synthwave" },
  { title: "Sunday hangover", description: "Lo-fi acoustic ballad about regretting last night.", vibe: "Lo-fi" },
  { title: "Gym warm-up", description: "Hard-hitting trap beat with chant-style hooks.", vibe: "Trap" },
  { title: "Festival anthem", description: "Big-room house drop, euphoric chorus, hands in the air.", vibe: "House" },
  { title: "Heartbreak letter", description: "Slow piano ballad with raw, emotional lyrics.", vibe: "Ballad" },
  { title: "Pirate radio cypher", description: "UK drill instrumental with sliding 808s and dark keys.", vibe: "Drill" },
];

function DashboardHome() {
  const { user } = useAuth();
  const dev = useDevMode();
  const { data: profile } = useProfile();
  const { isVip } = useRole();
  const { data: recentSongs = [] } = useRecentSongs(user?.id);

  const displayName = dev.isDev
    ? "Developer"
    : (profile?.display_name?.trim() || user?.email?.split("@")[0] || "there");
  const balance = profile?.coin_balance ?? 0;
  const hasSongs = recentSongs.length > 0;
  const welcomeRef = useRef<HTMLElement | null>(null);
  const scrimOpacity = useAdaptiveOverlay(welcomeRef, { min: 0.55, max: 0.92 });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-2 sm:px-4">
      {/* Welcome */}
      <section
        ref={welcomeRef}
        className="relative flex flex-col gap-3 overflow-hidden rounded-[2.5rem] border-2 border-white/15 bg-card/55 p-8 shadow-[0_24px_60px_-20px_rgba(80,60,255,0.45)] backdrop-blur-2xl sm:p-12"
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
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.55_0.22_268/0.28),transparent_60%)]" />
        {/* Cartoon floating blobs */}
        <div aria-hidden className="pointer-events-none absolute -right-10 top-8 h-40 w-40 rounded-full bg-primary/30 blur-2xl animate-[float_6s_ease-in-out_infinite]" />
        <div aria-hidden className="pointer-events-none absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-accent/30 blur-2xl animate-[float_8s_ease-in-out_infinite_reverse]" />

        <div className="relative flex flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
          <div className="order-2 flex w-full flex-row items-center gap-2 sm:order-none sm:w-auto sm:flex-row sm:items-center sm:text-lg">
            {isVip && (
              <Badge variant="secondary" className="justify-center gap-1 rounded-full border-2 border-white/20 px-3 py-1.5 text-xs shadow-glow sm:gap-1.5 sm:px-5 sm:py-2.5 sm:text-lg">
                <Sparkles className="h-4 w-4 sm:h-6 sm:w-6" /> VIP
              </Badge>
            )}
            <Badge variant="outline" className="justify-center gap-1.5 rounded-full border-2 border-white/20 bg-white/5 px-3 py-1.5 text-xs sm:gap-2 sm:px-5 sm:py-2.5 sm:text-lg">
              <Coins className="h-4 w-4 shrink-0 text-primary animate-[bounce_2s_ease-in-out_infinite] sm:h-6 sm:w-6" />
              <span className="truncate">{balance} OG coins</span>
            </Badge>
          </div>
          <div className="order-1 min-w-0 rounded-3xl bg-background/35 p-5 backdrop-blur-md ring-2 ring-white/10 sm:order-none sm:flex-1 sm:p-7">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground sm:text-xl">
              👋 Welcome back
            </p>
            <h1 className="font-display mt-3 text-[clamp(2.25rem,12vw,6rem)] font-black leading-[1.02] tracking-[-0.02em] text-foreground [text-shadow:0_4px_28px_rgba(0,0,0,0.75)] [overflow-wrap:break-word] [word-break:normal]">
              Hello,{" "}
              <em className="inline italic text-gradient-brand animate-[wiggle_3s_ease-in-out_infinite] origin-bottom [overflow-wrap:break-word] [word-break:normal]">
                {displayName}
              </em>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-[1.45] text-foreground [text-shadow:0_1px_12px_rgba(0,0,0,0.75)] sm:text-2xl md:text-3xl">
              Jump back into your music workspace or pick up a chat with OG Bot.
            </p>
          </div>
        </div>

      </section>

      {/* Primary CTAs */}
      <section className="grid grid-cols-1 items-stretch gap-4 sm:gap-6 md:grid-cols-2">
        <PrimaryCard
          to="/library"
          icon={<Music2 className="h-6 w-6" />}
          eyebrow="Music Hub"
          title="Create a song"
          body="Generate, refine and remix tracks tailored to your taste with the OG engine."
          cta="Open Music Hub"
        />
        <PrimaryCard
          to="/messenger"
          icon={<MessageSquareMore className="h-6 w-6" />}
          eyebrow="OG Messenger"
          title="Chat to OG Bot"
          body="Talk to your AI co-producer, brainstorm lyrics, or just shoot the breeze."
          cta="Open Messenger"
          variant="accent"
        />
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-5 text-lg uppercase tracking-[0.28em] text-muted-foreground sm:text-xl">
          ⚡ Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <QuickAction to="/library" icon={<Plus className="h-6 w-6" />} label="New song" />
          <QuickAction to="/library" icon={<Library className="h-6 w-6" />} label="MusicHUB" />
          <QuickAction to="/messenger" icon={<Wand2 className="h-6 w-6" />} label="Ask OG" />
          <QuickAction to="/buy-coins" icon={<Coins className="h-6 w-6" />} label="Buy coins" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Example prompts */}
        <Card className="rounded-[2rem] border-2 border-white/15 shadow-[0_18px_50px_-20px_rgba(80,60,255,0.35)] lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-4xl font-black sm:text-5xl">🎤 Try a prompt</CardTitle>
              <CardDescription className="text-lg">Tap one to start a song in seconds.</CardDescription>
            </div>
            <Link
              to="/library"
              preload="intent"
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "gap-1.5 rounded-full text-lg")}
            >
              Open studio <ArrowRight className="h-6 w-6" />
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <PromptCard key={p.title} prompt={p} />
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Next steps */}
        <Card className="rounded-[2rem] border-2 border-white/15 shadow-[0_18px_50px_-20px_rgba(80,60,255,0.35)]">
          <CardHeader>
            <CardTitle className="text-4xl font-black sm:text-5xl">✅ Next steps</CardTitle>
            <CardDescription className="text-lg">Get the most out of OG Studio.</CardDescription>
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
      className="group relative flex min-h-[420px] flex-col justify-between overflow-hidden rounded-[2rem] border-2 border-white/15 bg-card/70 p-6 shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-[720px] sm:p-12"
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
          <Bot className="h-28 w-28 sm:h-64 sm:w-64" strokeWidth={1.25} />
        ) : (
          <Disc3 className="h-28 w-28 animate-[spin_18s_linear_infinite] sm:h-64 sm:w-64" strokeWidth={1.25} />
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
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white/15 bg-gradient-brand-soft text-primary shadow-glow sm:h-20 sm:w-20">
          {icon}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground sm:text-base">{eyebrow}</p>
          <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        </div>
        <h3 className="font-display mt-4 text-[clamp(2.25rem,8.5vw,6.5rem)] font-black uppercase leading-[0.92] tracking-[-0.035em] drop-shadow-[0_6px_24px_rgba(80,60,255,0.35)] [overflow-wrap:break-word]">
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
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground sm:text-xl">{body}</p>

        {/* Feature chips */}
        <div className="mt-7 flex flex-wrap gap-2.5">
          {(isAccent
            ? [
                { icon: <Sparkles className="h-4 w-4" />, label: "AI co-producer" },
                { icon: <MessageSquareMore className="h-4 w-4" />, label: "Lyric brainstorm" },
                { icon: <Wand2 className="h-4 w-4" />, label: "Voice ideas" },
              ]
            : [
                { icon: <Mic2 className="h-4 w-4" />, label: "Lyrics" },
                { icon: <AudioLines className="h-4 w-4" />, label: "Beats" },
                { icon: <Radio className="h-4 w-4" />, label: "Remix" },
              ]
          ).map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-sm font-semibold text-foreground/80 backdrop-blur-sm"
            >
              {chip.icon}
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-10 inline-flex items-center gap-2 text-lg font-bold text-primary">
        <span className="rounded-full border-2 border-primary/40 bg-primary/15 px-5 py-2.5 backdrop-blur-sm transition-colors group-hover:bg-primary/25">
          {cta}
        </span>
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
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
      className="group flex h-auto items-center justify-start gap-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] px-6 py-5 backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:bg-white/[0.07] hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-brand-soft text-primary shadow-glow transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6">
        {icon}
      </span>
      <span className="text-xl font-bold">{label}</span>
    </Link>
  );
}

function PromptCard({ prompt }: { prompt: PromptIdea }) {
  return (
    <li>
      <Link
        to="/library"
        preload="intent"
        className="group flex h-full flex-col gap-2 rounded-2xl border-2 border-white/10 bg-white/[0.03] p-5 transition-all duration-200 hover:-translate-y-1 hover:rotate-[-0.5deg] hover:border-primary/50 hover:bg-white/[0.07] hover:shadow-glow"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xl font-bold text-foreground">{prompt.title}</p>
          <Badge variant="outline" className="shrink-0 rounded-full border-2 border-white/15 bg-white/[0.04] text-sm">
            {prompt.vibe}
          </Badge>
        </div>
        <p className="text-lg leading-relaxed text-muted-foreground">{prompt.description}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-base font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Use this prompt <ArrowRight className="h-5 w-5" />
        </span>
      </Link>
    </li>
  );
}

function RecentRow({ song }: { song: RecentSong }) {
  const title = song.title?.trim() || song.prompt?.slice(0, 60) || "Untitled";
  return (
    <li>
      <Link
        to="/library/$songId"
        params={{ songId: song.id }}
        className="group flex items-center gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-white/[0.04]"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-gradient-brand-soft shadow-card">
          {song.cover_url ? (
            <img
              src={song.cover_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          ) : (
            <Headphones className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {new Date(song.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 border-white/10 bg-white/[0.04] text-sm capitalize">
          {song.status}
        </Badge>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
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
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-dashed border-white/15 bg-gradient-brand-soft text-primary">
        <Music2 className="h-7 w-7" />
      </div>
      <div>
        <p className="text-base font-semibold">No songs yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate your first personalised track in Music Hub.
        </p>
      </div>
      <Link
        to="/library"
        className={cn(buttonVariants({ size: "lg", variant: "premium" }), "mt-2 rounded-full text-base")}
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
      className="flex items-center gap-3 rounded-md border border-transparent px-2 py-3 transition-colors hover:border-border hover:bg-muted/40"
    >
      {done ? (
        <CheckCircle2 className="h-6 w-6 text-primary" />
      ) : (
        <Circle className="h-6 w-6 text-muted-foreground" />
      )}
      <span className={"text-lg font-medium " + (done ? "text-muted-foreground line-through" : "")}>
        {label}
      </span>
      <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground" />
    </Link>
  );
}
