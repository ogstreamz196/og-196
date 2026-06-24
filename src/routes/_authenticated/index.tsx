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
import { useRef, useCallback, type PointerEvent as ReactPointerEvent } from "react";
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
    <div className="flex w-full flex-col space-y-10 sm:space-y-12">
      {/* Welcome */}
      <section
        ref={welcomeRef}
        className="group/welcome relative flex flex-col gap-3 overflow-hidden rounded-[2.5rem] border-2 border-white/15 bg-card/55 p-6 shadow-[0_24px_60px_-20px_rgba(80,60,255,0.45)] backdrop-blur-2xl sm:p-12"
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
        {/* Conic rotating halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-32 opacity-40 [background:conic-gradient(from_0deg,oklch(0.55_0.22_268/0.35),transparent_35%,oklch(0.7_0.22_25/0.3)_60%,transparent_85%,oklch(0.55_0.22_268/0.35))] animate-[spin_22s_linear_infinite] blur-3xl"
        />
        {/* Floating cartoon blobs */}
        <div aria-hidden className="pointer-events-none absolute -right-10 top-8 h-40 w-40 rounded-full bg-primary/30 blur-2xl wc-blob" />
        <div aria-hidden className="pointer-events-none absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-accent/30 blur-2xl wc-float-slow" />
        {/* Sparkle particles */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {[
            { top: "12%", left: "8%", d: "0s",   s: "h-2 w-2" },
            { top: "22%", left: "92%", d: "0.6s", s: "h-1.5 w-1.5" },
            { top: "68%", left: "14%", d: "1.2s", s: "h-1 w-1" },
            { top: "82%", left: "78%", d: "0.3s", s: "h-2 w-2" },
            { top: "44%", left: "55%", d: "1.8s", s: "h-1 w-1" },
          ].map((p, i) => (
            <span
              key={i}
              className={`absolute rounded-full bg-white/80 shadow-[0_0_12px_4px_rgba(255,255,255,0.45)] ${p.s} animate-[wc-pop_2.4s_ease-in-out_infinite]`}
              style={{ top: p.top, left: p.left, animationDelay: p.d }}
            />
          ))}
        </div>

        {/* Top marquee status strip */}
        <div className="relative -mx-6 -mt-6 mb-2 overflow-hidden border-b border-white/10 bg-white/[0.03] py-2 sm:-mx-12 sm:-mt-12 sm:mb-4">
          <div className="flex animate-[wc-shimmer_22s_linear_infinite] whitespace-nowrap text-xs font-bold uppercase tracking-[0.3em] text-foreground/70 [background:linear-gradient(90deg,transparent,oklch(1_0_0/0.15),transparent)] [background-size:200%_100%] sm:text-sm">
            {Array.from({ length: 2 }).map((_, k) => (
              <div key={k} className="flex shrink-0 items-center gap-6 px-6">
                <span className="inline-flex items-center gap-2"><Disc3 className="h-4 w-4 animate-[spin_4s_linear_infinite] text-primary" /> Live studio</span>
                <span className="opacity-40">✦</span>
                <span className="inline-flex items-center gap-2"><Radio className="h-4 w-4 text-accent" /> OG Bot online</span>
                <span className="opacity-40">✦</span>
                <span className="inline-flex items-center gap-2"><AudioLines className="h-4 w-4 text-primary" /> Beats ready</span>
                <span className="opacity-40">✦</span>
                <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Mint a hit</span>
                <span className="opacity-40">✦</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
          <div className="order-2 flex w-full flex-row items-center gap-2 sm:order-none sm:w-auto sm:flex-row sm:items-center sm:text-lg">
            {isVip && (
              <Badge variant="secondary" className="justify-center gap-1 rounded-full border-2 border-white/20 px-3 py-1.5 text-xs shadow-glow wc-bounce-soft sm:gap-1.5 sm:px-5 sm:py-2.5 sm:text-lg">
                <Sparkles className="h-4 w-4 animate-[wiggle_2s_ease-in-out_infinite] sm:h-6 sm:w-6" /> VIP
              </Badge>
            )}
            <Badge variant="outline" className="justify-center gap-1.5 rounded-full border-2 border-white/20 bg-white/5 px-3 py-1.5 text-xs sm:gap-2 sm:px-5 sm:py-2.5 sm:text-lg">
              <Coins className="h-4 w-4 shrink-0 text-primary animate-[bounce_2s_ease-in-out_infinite] sm:h-6 sm:w-6" />
              <span className="truncate">{balance} OG coins</span>
            </Badge>
            {/* Live mini equalizer */}
            <span aria-hidden className="ml-1 hidden items-end gap-[3px] rounded-full border-2 border-white/15 bg-white/[0.04] px-3 py-2 sm:inline-flex">
              <span className="inline-flex items-center gap-1.5 pr-2 text-xs font-bold uppercase tracking-[0.2em] text-foreground/70">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
              {[0.5, 0.9, 0.6, 1, 0.7].map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-gradient-to-t from-primary/60 to-primary"
                  style={{ height: `${h * 18}px`, animation: `eqPulse 0.${(i % 5) + 4}s ease-in-out ${i * 0.08}s infinite alternate` }}
                />
              ))}
            </span>
          </div>
          <div className="order-1 min-w-0 rounded-3xl bg-background/35 p-5 backdrop-blur-md ring-2 ring-white/10 transition-transform duration-500 group-hover/welcome:-translate-y-1 sm:order-none sm:flex-1 sm:p-7">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground sm:text-xl">
              <span className="inline-block animate-[wiggle_1.6s_ease-in-out_infinite] [transform-origin:70%_70%]">👋</span>
              <span className="relative">
                Welcome back
                <span aria-hidden className="absolute -bottom-1 left-0 h-[2px] w-full origin-left scale-x-0 bg-gradient-to-r from-primary via-accent to-primary animate-[shimmer_3s_ease-in-out_infinite] [animation:wc-pop_0.8s_0.3s_cubic-bezier(.34,1.56,.64,1)_forwards]" />
              </span>
            </p>
            <h1 className="font-display mt-3 text-[clamp(2rem,4.5vw+1rem,5rem)] font-black leading-[1.05] tracking-[-0.02em] text-foreground [text-shadow:0_4px_28px_rgba(0,0,0,0.75)] [overflow-wrap:break-word] [word-break:normal] [text-wrap:balance] [font-variant-ligatures:none]">
              <span className="inline-block wc-pop">Hello,</span>{" "}
              <span className="font-display inline-flex not-italic font-black uppercase tracking-tight text-gradient-red [overflow-wrap:break-word] [word-break:normal]">
                {displayName.split("").map((ch, i) => (
                  <span
                    key={`${ch}-${i}`}
                    className="inline-block wc-pop hover:animate-[wiggle_0.6s_ease-in-out]"
                    style={{ animationDelay: `${0.25 + i * 0.05}s`, whiteSpace: ch === " " ? "pre" : undefined }}
                  >
                    {ch}
                  </span>
                ))}
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-[1.45] text-foreground [text-shadow:0_1px_12px_rgba(0,0,0,0.75)] sm:text-2xl md:text-3xl">
              Jump back into your music workspace or pick up a chat with{" "}
              <span className="relative inline-block font-bold text-primary">
                OG Bot
                <span aria-hidden className="ml-1 inline-flex gap-0.5 align-middle">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1.2s_ease-in-out_infinite] [animation-delay:0s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1.2s_ease-in-out_infinite] [animation-delay:0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1.2s_ease-in-out_infinite] [animation-delay:0.3s]" />
                </span>
              </span>
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
          body="Generate. Remix. Release."
          cta="Open Music Hub"
        />
        <PrimaryCard
          to="/messenger"
          icon={<MessageSquareMore className="h-6 w-6" />}
          eyebrow="OG Messenger"
          title="Chat to OG Bot"
          body="Your AI co-producer."
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
  const graphicRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLAnchorElement | null>(null);
  const draggingRef = useRef(false);

  const applyParallax = useCallback((clientX: number, clientY: number) => {
    const root = rootRef.current;
    const el = graphicRef.current;
    if (!root || !el) return;
    const rect = root.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1; // -1..1
    const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
    el.style.setProperty("--px", `${nx * 18}px`);
    el.style.setProperty("--py", `${ny * 18}px`);
    el.style.setProperty("--rx", `${-ny * 12}deg`);
    el.style.setProperty("--ry", `${nx * 12}deg`);
    el.style.setProperty("--spin", `${nx * 25}deg`);
  }, []);

  const reset = useCallback(() => {
    const el = graphicRef.current;
    if (!el) return;
    el.style.setProperty("--px", `0px`);
    el.style.setProperty("--py", `0px`);
    el.style.setProperty("--rx", `0deg`);
    el.style.setProperty("--ry", `0deg`);
    el.style.setProperty("--spin", `0deg`);
  }, []);

  const handlePointerMove = (e: ReactPointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== "mouse" && !draggingRef.current) return;
    applyParallax(e.clientX, e.clientY);
  };
  const handlePointerDown = (e: ReactPointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType === "mouse") return;
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    applyParallax(e.clientX, e.clientY);
  };
  const handlePointerUp = (e: ReactPointerEvent<HTMLAnchorElement>) => {
    draggingRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
    reset();
  };

  return (
    <Link
      ref={rootRef}
      to={to}
      preload="intent"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={reset}
      onPointerCancel={reset}
      className="group @container relative flex flex-col justify-between overflow-hidden rounded-[2rem] border-2 border-white/15 bg-card/70 p-5 shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-[560px] sm:p-12 touch-none [perspective:1000px]"
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
      {/* HERO VISUAL — big centred animated graphic, takes the eye first */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl transition-transform duration-700 group-hover:scale-125" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-accent/20 blur-3xl transition-transform duration-700 group-hover:-translate-y-2" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center [perspective:1000px]">
        <div
          ref={graphicRef}
          className="relative will-change-transform transition-transform duration-300 ease-out [transform:translate3d(var(--px,0),var(--py,0),0)_rotateX(var(--rx,0))_rotateY(var(--ry,0))]"
        >
          {/* pulsing rings */}
          <span aria-hidden className="absolute inset-0 -m-6 rounded-full border-2 border-primary/30 animate-[ping_3s_ease-out_infinite]" />
          <span aria-hidden className="absolute inset-0 -m-12 rounded-full border-2 border-accent/20 animate-[ping_4.5s_ease-out_infinite]" />
          <span aria-hidden className="absolute inset-0 -m-20 rounded-full border-2 border-primary/10 animate-[ping_6s_ease-out_infinite]" />
          {/* main graphic */}
          <div
            className={
              "relative grid h-44 w-44 place-items-center rounded-full border-2 border-white/15 shadow-glow transition-transform duration-500 ease-out group-hover:scale-110 sm:h-72 sm:w-72 [transform:rotate(var(--spin,0))] " +
              (isAccent ? "bg-gradient-to-br from-accent/30 to-primary/40" : "bg-gradient-to-br from-primary/40 to-accent/30")
            }
            style={{ animation: "wc-float 6s ease-in-out infinite" }}
          >
            {isAccent ? (
              <Bot className="h-24 w-24 text-foreground drop-shadow-[0_8px_30px_rgba(80,60,255,0.55)] sm:h-40 sm:w-40 wc-wiggle" strokeWidth={1.4} />
            ) : (
              <Disc3 className="h-24 w-24 text-foreground drop-shadow-[0_8px_30px_rgba(80,60,255,0.55)] sm:h-40 sm:w-40 animate-[spin_8s_linear_infinite]" strokeWidth={1.4} />
            )}
          </div>
          {/* orbiting sparkle */}
          <span aria-hidden className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 [transform-origin:0_-90px] animate-[spin_5s_linear_infinite]">
            <Sparkles className="h-4 w-4 -translate-y-24 text-primary drop-shadow-[0_0_12px_rgba(120,100,255,0.9)]" />
          </span>
        </div>
      </div>

      {/* Equalizer bars bottom accent */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-end gap-1 opacity-70 transition-opacity duration-300 group-hover:opacity-100">
        {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.45, 0.85, 0.55, 0.7].map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-primary/60 to-primary"
            style={{
              height: `${h * 40}px`,
              animation: `eqPulse 1.${(i % 6) + 2}s ease-in-out ${i * 0.08}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-white/15 bg-gradient-brand-soft text-primary shadow-glow sm:h-12 sm:w-12">
            {icon}
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground sm:text-base">{eyebrow}</p>
          <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        </div>
        <h3 className="font-display mt-3 text-[clamp(1.4rem,2.5vw+0.75rem,3rem)] font-black uppercase leading-[1.05] tracking-[-0.025em] drop-shadow-[0_6px_24px_rgba(80,60,255,0.35)] [hyphens:none] [word-break:keep-all] [overflow-wrap:normal] [text-wrap:balance] sm:mt-4">
          {title.split(" ").map((word, i, arr) => {
            const isLast = i === arr.length - 1;
            return (
              <span
                key={`${word}-${i}`}
                className={
                  "wc-pop mr-[0.25em] inline-block whitespace-nowrap " +
                  (isLast ? "italic text-gradient-red wc-bounce-soft" : "")
                }
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                {word}
                {isLast ? "." : ""}
              </span>
            );
          })}
        </h3>
        <p className="mt-2 max-w-md text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:mt-3 sm:text-base">{body}</p>
      </div>


      <div className="relative mt-6 inline-flex items-center gap-2 text-base font-bold text-primary sm:mt-10 sm:text-lg">
        <span className="rounded-full border-2 border-primary/40 bg-primary/15 px-4 py-2 backdrop-blur-sm transition-colors group-hover:bg-primary/25 sm:px-5 sm:py-2.5">
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
              width={56}
              height={56}
              sizes="56px"
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
