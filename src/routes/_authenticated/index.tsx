import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  Gift,
  Infinity as InfinityIcon,
  Share2,
  TrendingUp,
  Send,
  Smartphone,
  Globe,
} from "lucide-react";
import { useRef, useState, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import ogBotAsset from "@/assets/ogbot.png.asset.json";
import musicHubHero from "@/assets/musichub-hero.jpg";

import { useAuth } from "@/hooks/use-auth";
import { useDevMode } from "@/hooks/use-dev-mode";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { useRecentSongs, type RecentSong } from "@/hooks/use-recent-songs";
import { useAdaptiveOverlay } from "@/hooks/use-adaptive-overlay";
import ogLogo from "@/assets/ogstreamz-logo.jpg.asset.json";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TelegramLinkStatus } from "@/components/dashboard/TelegramLinkStatus";
import { TelegramLinkChecklist } from "@/components/dashboard/TelegramLinkChecklist";
import { TelegramConnectPrompt } from "@/components/dashboard/TelegramConnectPrompt";

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

  const displayName =
    profile?.display_name?.trim() ||
    user?.email?.split("@")[0] ||
    (dev.isDev ? "Developer" : "there");
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
          <div className="order-1 w-full min-w-0 basis-full rounded-3xl bg-background/35 p-5 text-center backdrop-blur-md ring-2 ring-white/10 transition-transform duration-500 group-hover/welcome:-translate-y-1 sm:order-none sm:p-8">
            <p className="inline-flex items-center justify-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground sm:text-xl">
              <span className="inline-block animate-[wiggle_1.6s_ease-in-out_infinite] [transform-origin:70%_70%]">👋</span>
              <span className="relative">
                Welcome back
                <span aria-hidden className="absolute -bottom-1 left-0 h-[2px] w-full origin-left scale-x-0 bg-gradient-to-r from-primary via-accent to-primary animate-[shimmer_3s_ease-in-out_infinite] [animation:wc-pop_0.8s_0.3s_cubic-bezier(.34,1.56,.64,1)_forwards]" />
              </span>
            </p>
            <div className="mt-5 flex flex-col items-center gap-5 sm:gap-7">
              <img
                src={ogLogo.url}
                alt="OG Streamz"
                loading="lazy"
                className="mx-auto h-40 w-auto rounded-3xl ring-1 ring-white/10 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)] sm:h-56 md:h-72 lg:h-80"
              />
              <h1 className="font-display min-w-0 text-[clamp(2rem,4.5vw+1rem,5rem)] font-black leading-[1.05] tracking-[-0.02em] text-foreground [text-shadow:0_4px_28px_rgba(0,0,0,0.75)] [overflow-wrap:break-word] [word-break:normal] [text-wrap:balance] [font-variant-ligatures:none]">
                <span className="inline-block wc-pop">Hello,</span>{" "}
                <span className="paint-drip font-display inline-flex not-italic font-black uppercase tracking-tight text-gradient-red [overflow-wrap:break-word] [word-break:normal]">
                  {displayName.split("").map((ch, i) => (
                    <span
                      key={`${ch}-${i}`}
                      className="inline-block wc-pop hover:animate-[wiggle_0.6s_ease-in-out]"
                      style={{
                        animationDelay: `${0.25 + i * 0.05}s`,
                        whiteSpace: ch === " " ? "pre" : undefined,
                        background: "inherit",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                      }}
                    >
                      {ch}
                    </span>
                  ))}
                </span>
              </h1>
            </div>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-[1.5] text-foreground [text-shadow:0_1px_12px_rgba(0,0,0,0.75)] sm:text-xl md:text-2xl">
              Dive into <span className="font-bold text-primary">MusicHub</span> to create tracks, or open{" "}
              <span className="font-bold text-primary">OG Streamz Messenger</span> to chat with{" "}
              <span className="relative inline-block font-bold text-primary">
                OG Bot
                <span aria-hidden className="ml-1 inline-flex gap-0.5 align-middle">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1.2s_ease-in-out_infinite] [animation-delay:0s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1.2s_ease-in-out_infinite] [animation-delay:0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[bounce_1.2s_ease-in-out_infinite] [animation-delay:0.3s]" />
                </span>
              </span>
              .
            </p>
          </div>

        </div>

      </section>

      {/* Primary CTAs — MusicHub + OG Messenger at the top */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm uppercase tracking-[0.28em] text-muted-foreground sm:text-base">
            🚀 Jump in
          </h2>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-primary sm:inline">
            Powered by OG Bot
          </span>
        </div>
        <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-5">
          <PrimaryCard
            to="/library"
            image={musicHubHero}
            imageAlt="Neon vinyl with equalizer bars"
            eyebrow="MusicHub"
            title="Create a song"
            body="Generate · Remix · Release"
            cta="Open MusicHub"
          />
          <PrimaryCard
            to="/messenger"
            image={ogBotAsset.url}
            imageAlt="OG Bot avatar"
            eyebrow="OG Messenger"
            title="Chat to OG Bot"
            body="Your AI co-producer"
            cta="Open Messenger"
            variant="accent"
          />
        </div>
      </section>

      {/* Earn promo — stack OG Coins for real rewards (coming soon) */}
      <section>
        <Link
          to="/referrals"
          preload="intent"
          className="group relative flex flex-col gap-5 overflow-hidden rounded-[2rem] border-2 border-primary/40 bg-gradient-to-br from-primary/20 via-card/80 to-background p-6 shadow-[0_24px_60px_-20px_rgba(80,60,255,0.45)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-8 md:flex-row md:items-center md:justify-between"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/30 blur-3xl transition-transform duration-700 group-hover:scale-110"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-12 bottom-0 h-40 w-40 rounded-full bg-accent/25 blur-3xl"
          />
          <div className="relative space-y-3 md:max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                <Gift className="h-3 w-3" /> Earn · 10% lifetime
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
                <Sparkles className="h-3 w-3" /> Real rewards · coming soon
              </span>
            </div>
            <h2 className="font-display text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">
              Stack{" "}
              <span className="bg-gradient-to-r from-primary via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
                OG Coins
              </span>{" "}
              now — redeem for real, valuable items soon.
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Share your OG Link, earn{" "}
              <span className="font-semibold text-foreground">10% lifetime cashback</span> on every coin your crew
              burns, and bank a balance ready for upcoming{" "}
              <span className="font-semibold text-amber-300">real-world drops, merch and exclusive perks</span>.
              Stack up while it's early.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-foreground/85">
                <InfinityIcon className="h-3 w-3 text-primary" /> Lifetime
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-foreground/85">
                <TrendingUp className="h-3 w-3 text-emerald-400" /> Auto-paid
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-foreground/85">
                <Gift className="h-3 w-3 text-amber-300" /> Redeem soon
              </span>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-2 self-start rounded-full border border-primary/40 bg-background/70 px-5 py-3 text-sm font-bold text-primary shadow-glow backdrop-blur md:self-auto">
            <Share2 className="h-4 w-4" /> Start stacking
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </section>

      {/* Ask OG Bot — prompt CTA */}
      <AskOgCta />

      {/* Continuity demo */}
      <ContinuityDemo />

      {/* Quick actions */}
      <section>
        <h2 className="mb-4 text-sm uppercase tracking-[0.28em] text-muted-foreground sm:text-base">
          ⚡ Quick actions
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
          <QuickAction to="/library" icon={<Plus className="h-7 w-7" />} label="Create" tone="violet" />
          <QuickAction to="/library" icon={<Library className="h-7 w-7" />} label="Music" tone="cyan" />
          <QuickAction to="/messenger" icon={<Wand2 className="h-7 w-7" />} label="Ask OG" tone="pink" />
          <QuickAction to="/buy-coins" icon={<Coins className="h-7 w-7" />} label="Coins" tone="amber" />
          <QuickAction to="/referrals" icon={<Gift className="h-7 w-7" />} label="Earn" tone="emerald" />
        </div>
      </section>

      <TelegramConnectPrompt />
      <TelegramLinkStatus />
      <TelegramLinkChecklist />




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

function AskOgCta() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [service, setService] = useState<"musichub" | "messenger">("musichub");

  const handleStart = () => {
    const text = prompt.trim();
    if (text && typeof window !== "undefined") {
      try {
        window.localStorage.setItem("og:pending-prompt", JSON.stringify({ service, text, at: Date.now() }));
      } catch {}
    }
    setOpen(false);
    navigate({ to: service === "musichub" ? "/library" : "/messenger" });
  };

  return (
    <section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="group relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-[2rem] border-2 border-primary/50 bg-gradient-to-r from-primary/25 via-accent/20 to-primary/25 p-6 text-left shadow-[0_24px_60px_-20px_rgba(80,60,255,0.55)] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-primary hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-8"
          >
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/40 blur-3xl transition-transform duration-700 group-hover:scale-110" />
            <div className="relative flex items-center gap-5">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/30 ring-2 ring-primary/60 sm:h-16 sm:w-16">
                <Sparkles className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Ask OG Bot</div>
                <h2 className="font-display mt-1 text-2xl font-black leading-tight sm:text-4xl">
                  Start any task — pick a service & go
                </h2>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  Describe what you want. Send it to MusicHub or Messenger.
                </p>
              </div>
            </div>
            <span className="relative hidden shrink-0 items-center gap-2 rounded-full border border-primary/50 bg-background/70 px-5 py-3 text-sm font-bold text-primary shadow-glow sm:inline-flex">
              <Wand2 className="h-4 w-4" /> Open prompt
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-black">What do you want to do?</DialogTitle>
            <DialogDescription>
              Pick a service and tell OG Bot what to spin up. We'll drop you in with your prompt ready.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
              {(["musichub", "messenger"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setService(s)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
                    service === s
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s === "musichub" ? <Music2 className="h-4 w-4" /> : <MessageSquareMore className="h-4 w-4" />}
                  {s === "musichub" ? "MusicHub" : "Messenger"}
                </button>
              ))}
            </div>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                service === "musichub"
                  ? "e.g. Make a moody drill track about chasing the bag…"
                  : "e.g. Help me plan a release week for my new EP…"
              }
              rows={4}
              className="resize-none rounded-xl text-base"
            />
            <Button onClick={handleStart} size="lg" className="w-full gap-2 rounded-xl text-base font-bold">
              <Send className="h-4 w-4" />
              Start in {service === "musichub" ? "MusicHub" : "Messenger"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ContinuityDemo() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border-2 border-white/15 bg-card/55 p-6 shadow-[0_18px_50px_-20px_rgba(80,60,255,0.35)] backdrop-blur-xl sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/20 ring-1 ring-primary/40">
          <InfinityIcon className="h-5 w-5 text-primary" />
        </span>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Continue the conversation</div>
          <h2 className="font-display text-xl font-black sm:text-2xl">One bot, one memory, every surface.</h2>
        </div>
      </div>
      <div className="relative grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        <ChatBubbleCard
          channel="Web Messenger"
          icon={<Globe className="h-4 w-4" />}
          userMsg="Yo OG, I need a hook about late nights and big dreams."
          botMsg="On it — drill or trap? I'll draft 4 bars."
        />
        <div className="flex items-center justify-center text-primary sm:flex-col">
          <ArrowRight className="h-6 w-6 sm:hidden" />
          <ArrowRight className="hidden h-6 w-6 sm:block" />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground sm:ml-0 sm:mt-1">
            synced
          </span>
        </div>
        <ChatBubbleCard
          channel="MusicHub · Telegram"
          icon={<Smartphone className="h-4 w-4" />}
          userMsg="Drill. Make it dark."
          botMsg="Got it — using the late nights / big dreams hook from earlier. Generating now."
          highlight
        />
      </div>
      <p className="relative mt-5 text-center text-xs text-muted-foreground sm:text-sm">
        Every OG Bot — web, Messenger, Telegram, MusicHub — shares the same memory. Pick up exactly where you left off.
      </p>
    </section>
  );
}

function ChatBubbleCard({
  channel,
  icon,
  userMsg,
  botMsg,
  highlight = false,
}: {
  channel: string;
  icon: React.ReactNode;
  userMsg: string;
  botMsg: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-background/60 p-4 backdrop-blur",
        highlight ? "border-primary/50 shadow-[0_10px_30px_-15px_rgba(80,60,255,0.6)]" : "border-white/10",
      )}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
        {icon} {channel}
      </div>
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/85 px-3 py-2 text-sm text-primary-foreground">
        {userMsg}
      </div>
      <div className="mr-auto flex max-w-[85%] items-start gap-2">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/30 ring-1 ring-accent/50">
          <Bot className="h-3.5 w-3.5 text-accent-foreground" />
        </span>
        <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] px-3 py-2 text-sm text-foreground ring-1 ring-white/10">
          {botMsg}
        </div>
      </div>
    </div>
  );
}


function PrimaryCard({
  to,
  image,
  imageAlt,
  eyebrow,
  title,
  body,
  cta,
  variant = "primary",
}: {
  to: "/library" | "/messenger";
  image: string;
  imageAlt: string;
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
      className="group relative flex flex-col overflow-hidden rounded-3xl border-2 border-white/15 bg-card/70 shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Ambient gradient */}
      <div
        aria-hidden
        className={
          "pointer-events-none absolute inset-0 opacity-80 " +
          (isAccent
            ? "bg-[radial-gradient(circle_at_top,oklch(0.65_0.18_310/0.32),transparent_65%)]"
            : "bg-[radial-gradient(circle_at_top,oklch(0.55_0.22_268/0.32),transparent_65%)]")
        }
      />

      {/* HERO IMAGE — large, meaningful, fills the top */}
      <div className="relative aspect-square w-full overflow-hidden">
        <img
          src={image}
          alt={imageAlt}
          loading="lazy"
          width={768}
          height={768}
          className={
            "h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 " +
            (isAccent ? "p-4 sm:p-6" : "")
          }
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent"
        />
        {/* Equalizer overlay only for music card */}
        {!isAccent && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-end gap-1 opacity-90">
            {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.45, 0.85, 0.55, 0.7].map((h, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-gradient-to-t from-primary/70 to-primary"
                style={{
                  height: `${h * 22}px`,
                  animation: `eqPulse 1.${(i % 6) + 2}s ease-in-out ${i * 0.08}s infinite alternate`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Text + CTA */}
      <div className="relative z-10 flex flex-1 flex-col gap-2 p-3 sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary sm:text-xs">
          {eyebrow}
        </p>
        <h3 className="font-display text-xl font-black uppercase leading-[1.05] tracking-tight text-foreground sm:text-3xl">
          {title}
        </h3>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-sm">
          {body}
        </p>
        <div className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-bold text-primary sm:text-base">
          <span className="rounded-full border-2 border-primary/40 bg-primary/15 px-3 py-1.5 backdrop-blur-sm transition-colors group-hover:bg-primary/25 sm:px-4 sm:py-2">
            {cta}
          </span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 sm:h-5 sm:w-5" />
        </div>
      </div>
    </Link>
  );
}



const QUICK_TONES = {
  violet: "from-violet-500/30 to-fuchsia-500/20 text-violet-200 ring-violet-400/40",
  cyan: "from-cyan-500/30 to-sky-500/20 text-cyan-200 ring-cyan-400/40",
  pink: "from-pink-500/30 to-rose-500/20 text-pink-200 ring-pink-400/40",
  amber: "from-amber-500/30 to-orange-500/20 text-amber-200 ring-amber-400/40",
  emerald: "from-emerald-500/30 to-teal-500/20 text-emerald-200 ring-emerald-400/40",
} as const;

function QuickAction({
  to,
  icon,
  label,
  tone,
}: {
  to: "/library" | "/messenger" | "/buy-coins" | "/referrals";
  icon: React.ReactNode;
  label: string;
  tone: keyof typeof QUICK_TONES;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-4 text-center backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:bg-white/[0.08] hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:py-5"
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${QUICK_TONES[tone]} shadow-glow ring-1 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6 sm:h-14 sm:w-14`}
      >
        {icon}
      </span>
      <span className="text-sm font-bold leading-tight sm:text-base">{label}</span>
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
