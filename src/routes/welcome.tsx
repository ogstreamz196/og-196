import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
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
import { TutorialBubbles, type TutorialStep } from "@/components/TutorialBubbles";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ogBotAsset from "@/assets/ogbot.png.asset.json";
import partyCoverAsset from "@/assets/album-party-anthem.jpg.asset.json";
import heartbreakCoverAsset from "@/assets/album-heartbreak.jpg.asset.json";
import drillCoverAsset from "@/assets/album-drill.jpg.asset.json";
import afrobeatsCoverAsset from "@/assets/album-afrobeats.jpg.asset.json";
import { WelcomeBackdrop } from "@/components/layout/WelcomeBackdrop";

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
      { property: "og:image", content: "https://ogstreamz.co.uk/__l5e/assets-v1/c71b8b8a-3ff4-448e-ad15-3446b8fe5e88/ogbot.png" },
      { property: "og:image:alt", content: "OG Streamz bot" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://ogstreamz.co.uk/__l5e/assets-v1/c71b8b8a-3ff4-448e-ad15-3446b8fe5e88/ogbot.png" },
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

const PENDING_REF_KEY = "og_pending_ref";

function useRedirectIfSignedIn() {
  const navigate = useNavigate();
  useEffect(() => {
    // Capture ?ref=<uuid> from URL and stash for post-signup claim
    if (typeof window !== "undefined") {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
        try { localStorage.setItem(PENDING_REF_KEY, ref); } catch { /* ignore */ }
      }
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);
}

function useOAuthSignIn() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  const signIn = useCallback(
    async (provider: OAuthProvider) => {
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
    },
    [navigate],
  );

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


type Device = {
  key: string;
  label: string;
  provider: OAuthProvider;
  Icon: (p: { className?: string }) => ReactElement;
  iconClass?: string;
};

const TILE_CLASS =
  "group relative bg-white/[0.06] backdrop-blur-md border-2 border-white/15 rounded-[28px] " +
  "shadow-[0_10px_0_0_hsl(var(--primary)/0.35),0_24px_44px_-12px_hsl(var(--primary)/0.45)] " +
  "transition-all duration-150 ease-out " +
  "hover:-translate-y-1 hover:border-white/40 hover:bg-white/[0.1] " +
  "hover:shadow-[0_12px_0_0_hsl(var(--primary)/0.5),0_28px_50px_-10px_hsl(var(--primary)/0.6)] " +
  "active:translate-y-1 active:shadow-[0_4px_0_0_hsl(var(--primary)/0.35),0_10px_20px_-6px_hsl(var(--primary)/0.4)] " +
  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:opacity-70 disabled:cursor-wait disabled:translate-y-0 cursor-pointer";

const PRIMARY_DEVICES: Device[] = [
  { key: "google", label: "Google", provider: "google", Icon: GoogleIcon },
  { key: "apple", label: "Apple ID", provider: "apple", Icon: AppleIcon, iconClass: "text-black" },
];

const SECONDARY_DEVICES: Device[] = [
  { key: "android", label: "Android", provider: "google", Icon: AndroidIcon, iconClass: "text-[#3ddc84]" },
  { key: "samsung", label: "Samsung", provider: "google", Icon: SamsungIcon, iconClass: "text-[#1428a0]" },
  { key: "iphone", label: "iPhone / iPad", provider: "apple", Icon: IPhoneIcon, iconClass: "text-black" },
];

function AuthButtons({ size = "lg" }: { size?: "lg" | "xl" }) {
  const { signIn, pending } = useOAuthSignIn();
  const h = size === "xl" ? "h-36 sm:h-44 md:h-48" : "h-32 sm:h-40 md:h-44";

  // Defer the flame aura until after the welcome screen has fully painted +
  // gone idle so low-end phones aren't doing shadow compositing during the
  // initial render. Falls back to a timeout when requestIdleCallback is absent.
  const [auraOn, setAuraOn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (!cancelled) setAuraOn(true);
    };
    const raf = requestAnimationFrame(() => {
      const w = window as typeof window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof w.requestIdleCallback === "function") {
        const id = w.requestIdleCallback(start, { timeout: 1500 });
        return () => w.cancelIdleCallback?.(id);
      }
      const t = window.setTimeout(start, 600);
      return () => window.clearTimeout(t);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  const renderTile = useCallback(
    (d: Device) => {
      const isPending = pending === d.provider;
      const sub = d.provider === "google" ? "Sign in with Google" : "Sign in with Apple";
      return (
        <button
          key={d.key}
          onClick={() => signIn(d.provider)}
          disabled={pending !== null}
          aria-label={`${d.label} — ${sub}`}
          className={`${h} ${TILE_CLASS} ${auraOn ? "flame-aura" : ""} flex flex-col items-center justify-between gap-[clamp(0.5rem,1.2vw,0.875rem)] px-[clamp(0.5rem,1.2vw,0.875rem)] pt-[clamp(0.875rem,2vw,1.25rem)] pb-[clamp(0.5rem,1.2vw,0.875rem)] text-foreground`}
        >

          <div className="flex flex-1 items-center justify-center">
            {isPending ? (
              <Loader2 className="h-10 w-10 animate-spin text-foreground sm:h-16 sm:w-16" aria-hidden />
            ) : (
              <div className="grid aspect-square w-[clamp(3rem,9vw,6rem)] place-items-center rounded-[clamp(14px,2vw,24px)] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-2 ring-white/90 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[-3deg] group-active:scale-95">
                <div className={`grid place-items-center ${d.iconClass ?? "text-black"}`}>
                  <d.Icon className="h-[clamp(2.25rem,7vw,5.5rem)] w-[clamp(2.25rem,7vw,5.5rem)]" />
                </div>
              </div>
            )}
          </div>
          <div className="w-full min-w-0 space-y-1">
            <span className="font-display landing-tile-label block w-full rounded-xl bg-white px-[clamp(0.375rem,0.8vw,0.625rem)] py-[clamp(0.375rem,0.8vw,0.5rem)] text-center text-black shadow-[0_3px_0_0_rgba(0,0,0,0.15)] break-words">
              {d.label}
            </span>
            <span className="landing-tile-sub block text-center text-foreground/70 break-words">
              {sub}
            </span>
          </div>
        </button>
      );
    },
    [pending, signIn, h, auraOn],
  );

  const primaryTiles = useMemo(() => PRIMARY_DEVICES.map(renderTile), [renderTile]);
  const secondaryTiles = useMemo(() => SECONDARY_DEVICES.map(renderTile), [renderTile]);

  return (
    <div className="w-full space-y-5">
      <div className="relative mx-auto max-w-xl overflow-hidden rounded-3xl border-2 border-primary/50 bg-linear-to-br from-primary/25 via-primary/10 to-transparent px-3 py-5 text-center shadow-[0_12px_40px_-12px_rgba(59,130,246,0.55)] sm:px-5">
        <div className="pointer-events-none absolute inset-x-0 -top-1/2 h-full animate-pulse bg-linear-to-b from-primary/20 to-transparent blur-2xl" aria-hidden />
        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-primary/60 bg-primary/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary-foreground sm:gap-2 sm:px-3 sm:text-xs sm:tracking-[0.2em]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground sm:h-5 sm:w-5 sm:text-[11px]">1</span>
          Step 1
        </span>
        <p className="relative mt-2 font-display text-[clamp(1.6rem,8vw,3rem)] font-black uppercase leading-[1.05] tracking-[0.02em] text-foreground sm:text-4xl sm:tracking-[0.04em] md:text-5xl">
          <span aria-hidden>👇 </span>Select Your Device
        </p>
      </div>



      <div className="landing-card-tight relative overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/[0.06] via-transparent to-transparent" aria-hidden />
        <div className="relative landing-grid">
          <div className="landing-grid grid-cols-2">{primaryTiles}</div>
          <div className="landing-grid grid-cols-3">{secondaryTiles}</div>
        </div>
      </div>
    </div>
  );
}




const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "tap-device",
    selector: "#sign-in",
    title: "Start here 👇",
    body: "Tap the tile that matches your device — Google, Apple, Android, Samsung or iPhone — to sign in.",
    placement: "top",
  },
  {
    id: "scroll-styles",
    selector: "#studio",
    title: "Scroll down",
    body: "See the song styles you can prompt — drill, afrobeats, pop, R&B and more.",
    placement: "bottom",
  },
];

function WelcomePage() {
  // Single session check for the whole page (AuthButtons is mounted twice).
  useRedirectIfSignedIn();
  return (
    <AdminEditModeProvider>
      <main className="relative min-h-dvh overflow-x-hidden text-foreground">
        <WelcomeBackdrop />
        <TopNav />
        <Hero />
        <Pillars />
        <HowItWorks />
        <ClosingCta />
        <Footer />
        <TutorialBubbles steps={TUTORIAL_STEPS} storageKey="welcome.tutorial.dismissed" />
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




function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-background/40 backdrop-blur-xl">
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20 sm:px-8">
        <Link to="/welcome" aria-label="OG Streamz — home" className="group flex min-w-0 items-center gap-3">
          <span aria-hidden className="wc-wiggle grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow sm:h-11 sm:w-11">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-none">
            <p className="font-display truncate text-lg font-black uppercase tracking-tight sm:text-xl">OG Streamz</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">
              <span>Powered by</span>
              <OgBotLogo className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              <span>OG Bot</span>
            </p>
          </div>
        </Link>

      </nav>
    </header>

  );
}

function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col justify-center px-4 pt-8 pb-12 sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:pt-10 sm:pb-16">
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

        <div className="wc-pop mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-base font-extrabold uppercase tracking-[0.18em] backdrop-blur-xl sm:mt-12 sm:gap-4 sm:px-8 sm:py-4 sm:text-2xl md:text-3xl">
          <span className="h-3 w-3 animate-pulse rounded-full bg-primary shadow-glow sm:h-3.5 sm:w-3.5" />
          <span>Bespoke tracks · made for you by</span>
          <OgBotLogo className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16" />
          <span className="text-gradient-brand">OG BOT</span>
        </div>

        <h1 className="font-display mt-6 text-[clamp(2.5rem,11vw,12rem)] font-black leading-[0.88] tracking-[-0.055em] drop-shadow-[0_8px_30px_rgba(80,60,255,0.35)] sm:mt-10 sm:leading-[0.85]">
          <span className="wc-pop block">PROMPT IT.</span>
          <span className="wc-pop block" style={{ animationDelay: "0.15s" }}>
            MAKE A{" "}
            <span
              className="italic text-gradient-brand wc-bounce-soft inline-block"
              style={{ animationDelay: "0.3s" }}
            >
              PERSONAL
            </span>
          </span>
          <span className="wc-pop block" style={{ animationDelay: "0.3s" }}>
            MUSIC TRACK.
          </span>
        </h1>


        <div id="sign-in" className="mx-auto mt-10 max-w-3xl scroll-mt-24 sm:mt-14">
          <AuthButtons size="xl" />
          <p className="mt-5 text-center text-base font-bold text-foreground sm:mt-6 sm:text-xl">
            Free to start — no card required
          </p>
        </div>





        <AlbumCoverShowcase />
      </div>


    </section>
  );
}

function AlbumCoverShowcase() {
  const examples = [
    { label: "Their name", example: "“For my sister Aaliyah…”", emoji: "🪪" },
    { label: "The occasion", example: "“…her 30th birthday this Saturday.”", emoji: "🎂" },
    { label: "What they love", example: "“Obsessed with afrobeats, mango margaritas and her dog Bruno.”", emoji: "💛" },
    { label: "An inside joke or memory", example: "“Remind her about the karaoke night we don’t talk about.”", emoji: "🤫" },
  ];

  return (
    <div className="mx-auto mt-12 max-w-4xl px-1 sm:mt-16 sm:px-0">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground sm:text-sm">
          What to tell us
        </p>
        <h3 className="font-display mt-3 text-balance text-3xl font-semibold leading-[1.05] tracking-[-0.03em] sm:mt-4 sm:text-5xl md:text-6xl">
          The more personal, <em className="italic text-gradient-brand">the better the song</em>
        </h3>
      </div>

      <ul className="mt-8 grid gap-4 sm:mt-10 sm:gap-6 md:grid-cols-2">
        {examples.map((e, i) => (
          <li
            key={e.label}
            className="group relative flex items-start gap-4 rounded-[2rem] border-2 border-white/15 bg-card/70 p-6 text-left shadow-[0_18px_50px_-20px_rgba(80,60,255,0.35)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-primary/40 sm:p-8"
          >
            <CardEditBadge />
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-2xl shadow-glow sm:h-14 sm:w-14 sm:text-3xl">
              {e.emoji}
            </span>
            <div className="min-w-0">
              <EditableContent
                as="p"
                contentKey={`welcome.example.${i}.label`}
                defaultValue={e.label}
                className="text-xs font-black uppercase tracking-[0.24em] text-primary sm:text-sm"
              />
              <EditableContent
                as="p"
                multiline
                contentKey={`welcome.example.${i}.example`}
                defaultValue={e.example}
                className="mt-2 block text-lg font-semibold leading-snug text-foreground sm:text-xl"
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-sm font-semibold text-muted-foreground sm:mt-8 sm:text-base">
        Even one or two details turns into a track that feels like <em className="italic text-foreground">them</em>. 🎧
      </p>
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
    <section id="studio" className="relative scroll-mt-24">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24 lg:py-32">

        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground sm:text-sm">
            Prompt playground
          </p>
          <h2 className="font-display mt-3 flex flex-wrap items-center justify-center gap-3 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:mt-4 sm:gap-4 sm:text-6xl md:text-7xl lg:text-8xl">
            <span>Different songs</span>
            <OgBotLogo className="h-12 w-12 sm:h-20 sm:w-20 md:h-24 md:w-24 lg:h-28 lg:w-28" />
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:mt-16 sm:gap-6 md:grid-cols-3">
          {items.map((it) => (
            <article
              key={it.key}
              style={{ transform: `rotate(${it.tilt}deg)` }}
              className="group relative rounded-[2rem] border-2 border-white/15 bg-card/80 p-6 shadow-[0_18px_50px_-20px_rgba(80,60,255,0.35)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-2 hover:rotate-0 hover:border-primary/40 hover:shadow-glow sm:p-8"
            >
              <CardEditBadge />
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6 sm:h-14 sm:w-14">
                  {it.icon}
                </span>
                <span className="text-2xl sm:text-3xl">{it.emoji}</span>
              </div>
              <EditableContent
                as="h3"
                contentKey={`welcome.pillar.${it.key}.title`}
                defaultValue={String(it.title)}
                className="font-display mt-5 block text-4xl font-black tracking-tight sm:mt-6 sm:text-5xl"
              />
              <EditableContent
                as="p"
                multiline
                contentKey={`welcome.pillar.${it.key}.body`}
                defaultValue={it.body}
                className="mt-3 block text-lg leading-relaxed text-muted-foreground sm:mt-4"
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
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground sm:text-sm">
            How it works
          </p>
          <h2 className="font-display mt-3 text-balance text-4xl font-semibold tracking-[-0.035em] sm:mt-4 sm:text-6xl md:text-7xl lg:text-8xl">
            Easy as <em className="italic text-gradient-brand">1 · 2 · 3</em>
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="group relative rounded-[2rem] border-2 border-white/15 bg-card/70 p-6 text-center shadow-[0_18px_50px_-20px_rgba(80,60,255,0.35)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-primary/40 sm:p-8"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <CardEditBadge />
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-brand text-3xl font-black text-primary-foreground shadow-glow wc-bounce-soft sm:h-20 sm:w-20 sm:text-4xl">
                {s.n}
              </div>
              <div className="mt-4 text-5xl sm:mt-5 sm:text-6xl">{s.emoji}</div>
              <EditableContent as="h3" contentKey={`welcome.step.${s.n}.title`} defaultValue={s.title}
                className="font-display mt-3 block text-4xl font-black sm:mt-4 sm:text-5xl" />
              <EditableContent as="p" multiline contentKey={`welcome.step.${s.n}.body`} defaultValue={s.body}
                className="mt-2 block text-lg text-muted-foreground sm:mt-3" />
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
      <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-8 sm:py-28 lg:py-32">
        <CardEditBadge />
        <EditableContent as="p" contentKey="welcome.closing.eyebrow" defaultValue="Ready?"
          className="block text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground sm:text-sm" />
        <EditableContent as="h2" contentKey="welcome.closing.title" defaultValue="Your next prompt could be a hit."
          multiline
          className="font-display mt-4 block text-balance text-5xl font-semibold leading-[0.95] tracking-[-0.045em] sm:mt-5 sm:text-7xl md:text-8xl lg:text-9xl" />
        <EditableContent as="p" multiline contentKey="welcome.closing.body"
          defaultValue="Sign in. Type the idea. Pick the vibe. Get the cover and the song. 🎉"
          className="mx-auto mt-6 block max-w-2xl text-lg text-muted-foreground sm:mt-8 sm:text-2xl md:text-3xl" />

        <div className="mx-auto mt-10 max-w-2xl sm:mt-12">
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
