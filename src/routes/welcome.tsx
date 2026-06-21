import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Music2,
  Sparkles,
  Loader2,
  Headphones,
  Heart,
  Star,
  Wand2,
  Mic2,
  Pencil,
} from "lucide-react";
import { EditableContent } from "@/components/admin/EditableContent";
import {
  AdminEditModeProvider,
  AdminEditModeToggle,
  useAdminEditMode,
} from "@/components/admin/AdminEditMode";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ogBotAsset from "@/assets/ogbot.png.asset.json";
import partyCoverAsset from "@/assets/album-party-anthem.jpg.asset.json";
import heartbreakCoverAsset from "@/assets/album-heartbreak.jpg.asset.json";
import drillCoverAsset from "@/assets/album-drill.jpg.asset.json";
import afrobeatsCoverAsset from "@/assets/album-afrobeats.jpg.asset.json";

function OgBotLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={ogBotAsset.url}
      alt="OG Bot"
      className={`inline-block aspect-square rounded-xl object-cover align-middle shadow-glow ${className}`}
    />
  );
}

export const Route = createFileRoute("/welcome")({
  ssr: false,
  component: WelcomePage,
  head: () => ({
    meta: [
      { title: "OG Studio — Prompt Songs & Album Covers" },
      {
        name: "description",
        content:
          "Turn prompts, moods and memories into different song styles with album covers. Sign in with Google or Apple.",
      },
      { property: "og:title", content: "OG Studio — Prompt Songs & Album Covers" },
      {
        property: "og:description",
        content: "Prompt rap, pop, drill, afrobeats, heartbreak and party songs with cover art.",
      },
    ],
  }),
});

type OAuthProvider = "google" | "apple";

const albumCovers = [
  {
    title: "Party anthem",
    prompt: "Make it loud, funny and ready for the group chat.",
    style: "Pop · Dance",
    image: partyCoverAsset.url,
  },
  {
    title: "Heartbreak hook",
    prompt: "Turn the messy message into a chorus people feel.",
    style: "R&B · Ballad",
    image: heartbreakCoverAsset.url,
  },
  {
    title: "Street energy",
    prompt: "Give it a cold intro, sharp bars and heavy bass.",
    style: "Rap · Drill",
    image: drillCoverAsset.url,
  },
  {
    title: "Summer bounce",
    prompt: "Sunny, catchy and made for the speakers.",
    style: "Afrobeats · Vibes",
    image: afrobeatsCoverAsset.url,
  },
];

function useOAuthSignIn() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function signIn(provider: OAuthProvider) {
    setPending(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
        extraParams: provider === "google" ? { prompt: "select_account" } : undefined,
      });
      if (result.error) {
        const raw = (result.error.message ?? "").toLowerCase();
        const transient =
          raw.includes("authorization code") || raw.includes("code verifier") || raw.includes("pkce");
        if (!transient) toast.error(result.error.message || `${provider} sign-in failed`);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/", replace: true });
    } catch (e) {
      const raw = (e instanceof Error ? e.message : "").toLowerCase();
      const transient =
        raw.includes("authorization code") || raw.includes("code verifier") || raw.includes("pkce");
      if (!transient) toast.error(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setPending(null);
    }
  }
  return { signIn, pending };
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.6-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.2 10.1.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.4-.8s2 .8 3.4.8c1.4 0 2.3-1.2 3.2-2.5.7-1 1.2-2.1 1.5-3.3-2.5-.9-3.2-2.7-3.2-3.5zM13.8 5.2c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.6.8-1.2 2-1 3.1 1.1.1 2.2-.6 2.9-1.5z" />
    </svg>
  );
}

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="#3DDC84">
      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.43 11.43 0 0 0-8.94 0L5.65 5.67a.61.61 0 0 0-.83-.22c-.3.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 0 0 1 18h22a10.78 10.78 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"/>
    </svg>
  );
}

function SamsungIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="2" width="12" height="20" rx="2.5" fill="#1428A0"/>
      <rect x="7.25" y="4" width="9.5" height="14" rx="0.6" fill="#0a1a6e"/>
      <circle cx="12" cy="20" r="0.7" fill="#fff"/>
    </svg>
  );
}

function IPhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="2" width="12" height="20" rx="2.8" fill="#1a1a1a" stroke="#444" strokeWidth="0.5"/>
      <rect x="7.25" y="4.5" width="9.5" height="13.5" rx="0.6" fill="#0d1117"/>
      <rect x="10.5" y="3" width="3" height="0.7" rx="0.35" fill="#2a2a2a"/>
      <circle cx="12" cy="20.2" r="0.6" fill="#2a2a2a"/>
    </svg>
  );
}

function AuthButtons({ size = "lg" }: { size?: "lg" | "xl" }) {
  const { signIn, pending } = useOAuthSignIn();
  const h = size === "xl" ? "h-28" : "h-24";
  const silver =
    "bg-[linear-gradient(180deg,#fdfdfd_0%,#e8eaed_50%,#c8ccd1_100%)] border border-[#b5b9be] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.25)] hover:brightness-[1.03] active:brightness-95";
  return (
    <div className="w-full space-y-3">
      <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-foreground/80">
        Pick your device to continue
      </p>
      <div className="grid w-full gap-3 sm:grid-cols-2">
        <button
          onClick={() => signIn("google")}
          disabled={pending !== null}
          style={{ fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif' }}
          className={`${h} ${silver} group inline-flex flex-col items-center justify-center gap-1.5 rounded-2xl px-5 text-[#1f1f1f] transition disabled:opacity-70 disabled:cursor-wait`}
          aria-label="Sign in with Google for Android, Samsung and Pixel phones"
        >
          <div className="flex h-10 items-center justify-center gap-3">
            {pending === "google" ? (
              <Loader2 className="h-9 w-9 animate-spin" />
            ) : (
              <>
                <GoogleIcon className="h-9 w-9" />
                <span className="h-7 w-px bg-[#b5b9be]" />
                <AndroidIcon className="h-9 w-9" />
                <SamsungIcon className="h-9 w-9" />
              </>
            )}
          </div>
          <span className="text-base font-semibold tracking-tight">Sign in with Google</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5f6368]">
            Android · Samsung · Pixel
          </span>
        </button>
        <button
          onClick={() => signIn("apple")}
          disabled={pending !== null}
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}
          className={`${h} ${silver} group inline-flex flex-col items-center justify-center gap-1.5 rounded-2xl px-5 text-[#1f1f1f] transition disabled:opacity-70 disabled:cursor-wait`}
          aria-label="Sign in with Apple for iPhone and iPad"
        >
          <div className="flex h-10 items-center justify-center gap-3">
            {pending === "apple" ? (
              <Loader2 className="h-9 w-9 animate-spin" />
            ) : (
              <>
                <AppleIcon className="h-9 w-9 text-[#1f1f1f]" />
                <span className="h-7 w-px bg-[#b5b9be]" />
                <IPhoneIcon className="h-9 w-9" />
              </>
            )}
          </div>
          <span className="text-base font-semibold tracking-tight">Sign in with Apple</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5f6368]">
            iPhone · iPad
          </span>
        </button>
      </div>
      <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-center text-sm font-bold text-amber-200">
        ⚠️ Tap <span className="underline">Allow</span> / <span className="underline">Accept</span> on every prompt that appears after picking your device.
      </p>
    </div>
  );
}



function WelcomePage() {
  return (
    <AdminEditModeProvider>
      <main className="relative min-h-screen overflow-x-hidden text-foreground">
        <Blobs />
        <TopNav />
        <Hero />
        <Pillars />
        <HowItWorks />
        <ClosingCta />
        <Footer />
        <div className="fixed bottom-4 right-4 z-50">
          <AdminEditModeToggle />
        </div>
      </main>
    </AdminEditModeProvider>
  );
}

function CardEditBadge() {
  const { enabled } = useAdminEditMode();
  const { isAdmin } = useRole();
  if (!enabled || !isAdmin) return null;
  return (
    <div
      className="pointer-events-none absolute left-3 top-3 z-20 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow ring-2 ring-background"
      title="This card is editable — click any text to edit"
    >
      <Pencil className="h-3.5 w-3.5" />
    </div>
  );
}

function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="wc-blob absolute -left-32 top-10 h-[420px] w-[420px] rounded-full bg-gradient-brand opacity-40 blur-3xl" />
      <div
        className="wc-blob absolute -right-24 top-40 h-[360px] w-[360px] rounded-full bg-gradient-brand-soft opacity-60 blur-3xl"
        style={{ animationDelay: "-5s" }}
      />
      <div
        className="wc-blob absolute left-1/3 bottom-0 h-[480px] w-[480px] rounded-full bg-gradient-brand opacity-30 blur-3xl"
        style={{ animationDelay: "-9s" }}
      />
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-background/40 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/welcome" className="group flex items-center gap-3">
          <span className="wc-wiggle grid h-11 w-11 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="leading-none">
            <p className="font-display text-xl font-semibold tracking-tight">OG Studio</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              Music Hub
            </p>
          </div>
        </Link>

        <Link to="/auth">
          <Button className="h-11 rounded-xl px-5 text-sm font-semibold bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95">
            Sign in
          </Button>
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col justify-center px-5 pt-10 pb-16 sm:px-8">
      {/* Floating stickers */}
      <Sticker className="left-[4%] top-10 wc-float" rotate="-12">
        <Heart className="h-6 w-6 text-pink-400" />
      </Sticker>
      <Sticker className="right-[6%] top-16 wc-float-slow" rotate="14">
        <Star className="h-6 w-6 text-amber-300" />
      </Sticker>
      <Sticker className="left-[8%] bottom-[18%] wc-float-slow" rotate="8">
        <Headphones className="h-6 w-6 text-primary" />
      </Sticker>
      <Sticker className="right-[6%] bottom-[22%] wc-float" rotate="-10">
        <Mic2 className="h-6 w-6 text-violet-300" />
      </Sticker>

      <div className="relative mx-auto w-full max-w-6xl text-center">
        <div className="mx-auto max-w-3xl">
          <AuthButtons size="xl" />
          <p className="mt-6 text-lg font-bold text-foreground sm:text-xl">
            Free to start — no card required
          </p>
        </div>

        <div className="wc-pop mt-12 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-base font-semibold uppercase tracking-[0.18em] backdrop-blur-xl">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary shadow-glow" />
          <span>Prompt Lab · song styles by</span>
          <OgBotLogo className="h-6 w-6" />
        </div>

        <h1 className="font-display mt-10 text-[clamp(5rem,16vw,13rem)] font-black leading-[0.85] tracking-[-0.055em] drop-shadow-[0_8px_30px_rgba(80,60,255,0.35)]">
          <span className="wc-pop block">PROMPT IT.</span>
          <span className="wc-pop block" style={{ animationDelay: "0.15s" }}>
            MAKE A{" "}
            <span
              className="italic text-gradient-brand wc-bounce-soft inline-block"
              style={{ animationDelay: "0.3s" }}
            >
              BANGER.
            </span>
          </span>
        </h1>

        <p className="mx-auto mt-10 max-w-4xl text-3xl font-semibold leading-[1.15] text-foreground/90 sm:text-4xl md:text-5xl">
          Type a wild idea, a name, a mood, a memory.
          <br className="hidden sm:block" />
          Pick rap, afrobeats, pop, drill, heartbreak or party. <span className="inline-block wc-wiggle">🎧</span>
        </p>

        <AlbumCoverShowcase />
      </div>


    </section>
  );
}

function AlbumCoverShowcase() {
  return (
    <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-4">
      {albumCovers.map((cover, i) => (
        <article
          key={cover.title}
          className="group relative overflow-hidden rounded-3xl border-2 border-white/15 bg-card/80 shadow-card transition-all duration-300 hover:-translate-y-2 hover:rotate-0 hover:border-primary/50 hover:shadow-glow"
          style={{ transform: `rotate(${[-3, 2, -1, 3][i]}deg)` }}
        >
          <CardEditBadge />
          <img
            src={cover.image}
            alt={`${cover.title} album cover`}
            width={768}
            height={768}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-x-0 bottom-0 bg-background/75 p-3 text-left backdrop-blur-md">
            <EditableContent as="p" contentKey={`welcome.album.${i}.title`} defaultValue={cover.title}
              className="font-display text-xl leading-none tracking-tight sm:text-2xl" />
            <EditableContent as="p" contentKey={`welcome.album.${i}.style`} defaultValue={cover.style}
              className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-primary" />
            <EditableContent as="p" contentKey={`welcome.album.${i}.prompt`} defaultValue={cover.prompt}
              multiline
              className="mt-2 hidden text-xs font-bold leading-tight text-foreground/85 sm:block" />
          </div>
        </article>
      ))}
    </div>
  );
}

function Sticker({
  children,
  className,
  rotate,
}: {
  children: React.ReactNode;
  className?: string;
  rotate: string;
}) {
  return (
    <div
      className={`absolute hidden sm:grid place-items-center h-12 w-12 rounded-2xl border-2 border-white/20 bg-card/80 shadow-card backdrop-blur-xl ${className ?? ""}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </div>
  );
}

function Pillars() {
  const items: Array<{
    icon: React.ReactNode;
    emoji: string;
    title: React.ReactNode;
    body: string;
    tilt: string;
    key: string;
  }> = [
    {
      key: "hub",
      icon: <Music2 className="h-7 w-7" />,
      emoji: "🎵",
      title: "Prompt anything",
      body: "Drop a birthday roast, love note, voice note, inside joke or full story — turn the chaos into a song.",
      tilt: "-2",
    },
    {
      key: "bot",
      icon: <Wand2 className="h-7 w-7" />,
      emoji: "🪄",
      title: "Pick the vibe",
      body: "Go drill, rap, afrobeats, dance, pop, R&B, sad ballad, hype anthem or silly meme song.",
      tilt: "1.5",
    },
    {
      key: "msg",
      icon: <Sparkles className="h-7 w-7" />,
      emoji: "💿",
      title: "Cover included",
      body: "Every song idea feels like a real drop with colourful cover art and a track ready to play.",
      tilt: "-1",
    },
  ];

  return (
    <section id="studio" className="relative">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Prompt playground
          </p>
          <h2 className="font-display mt-4 flex flex-wrap items-center justify-center gap-4 text-6xl font-semibold leading-[1] tracking-[-0.035em] sm:text-7xl md:text-8xl">
            <span>Different songs</span>
            <OgBotLogo className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28" />
          </h2>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {items.map((it) => (
            <article
              key={it.key}
              style={{ transform: `rotate(${it.tilt}deg)` }}
              className="group relative rounded-3xl border-2 border-white/12 bg-card/80 p-8 backdrop-blur-xl transition-all duration-200 hover:-translate-y-2 hover:rotate-0 hover:border-primary/40 hover:shadow-glow"
            >
              <CardEditBadge />
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6">
                  {it.icon}
                </span>
                <span className="text-3xl">{it.emoji}</span>
              </div>
              <EditableContent
                as="h3"
                contentKey={`welcome.pillar.${it.key}.title`}
                defaultValue={String(it.title)}
                className="font-display mt-6 block text-4xl font-semibold tracking-tight sm:text-5xl"
              />
              <EditableContent
                as="p"
                multiline
                contentKey={`welcome.pillar.${it.key}.body`}
                defaultValue={it.body}
                className="mt-4 block text-lg leading-relaxed text-muted-foreground sm:text-xl"
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}


function HowItWorks() {
  const steps = [
    { n: "1", emoji: "✍️", title: "Write the prompt", body: "A name, joke, mood, memory, drama or wild idea." },
    { n: "2", emoji: "🎛️", title: "Choose the sound", body: "Rap, pop, drill, afrobeats, dance, R&B or ballad." },
    { n: "3", emoji: "💿", title: "Drop the track", body: "Get lyrics, music and cover art made for the moment." },
  ];
  return (
    <section className="relative border-t border-white/10">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">
            How it works
          </p>
          <h2 className="font-display mt-4 text-6xl font-semibold tracking-[-0.035em] sm:text-7xl md:text-8xl">
            Easy as <em className="italic text-gradient-brand">1 · 2 · 3</em>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="group relative rounded-3xl border-2 border-white/12 bg-card/70 p-8 text-center backdrop-blur-xl transition hover:-translate-y-1 hover:border-primary/40"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <CardEditBadge />
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-brand text-4xl font-black text-primary-foreground shadow-glow wc-bounce-soft">
                {s.n}
              </div>
              <div className="mt-5 text-6xl">{s.emoji}</div>
              <EditableContent as="h3" contentKey={`welcome.step.${s.n}.title`} defaultValue={s.title}
                className="font-display mt-4 block text-3xl font-semibold sm:text-4xl" />
              <EditableContent as="p" multiline contentKey={`welcome.step.${s.n}.body`} defaultValue={s.body}
                className="mt-3 block text-lg text-muted-foreground sm:text-xl" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section id="how" className="relative border-t border-white/10">
      <div className="mx-auto max-w-4xl px-5 py-28 text-center sm:px-8 lg:py-32">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Ready?
        </p>
        <h2 className="font-display mt-5 text-7xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-8xl md:text-9xl">
          Your next prompt
          <br />
          <em className="italic text-gradient-brand wc-bounce-soft inline-block">
            could be a hit.
          </em>
        </h2>
        <p className="mx-auto mt-8 max-w-2xl text-2xl text-muted-foreground sm:text-3xl">
          Sign in. Type the idea. Pick the vibe. Get the cover and the song. <span className="inline-block wc-wiggle">🎉</span>
        </p>

        <div className="mx-auto mt-12 max-w-2xl">
          <AuthButtons size="xl" />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:px-8">
        <span className="inline-flex items-center gap-2">© {new Date().getFullYear()} OG Studio · Prompt songs powered by <OgBotLogo className="h-5 w-5" /></span>
        <div className="flex items-center gap-6">
          <Link to="/auth" className="transition hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
