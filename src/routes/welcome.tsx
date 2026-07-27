import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ogBotAsset from "@/assets/ogbot.png.asset.json";
import partyCoverAsset from "@/assets/album-party-anthem.jpg.asset.json";
import heartbreakCoverAsset from "@/assets/album-heartbreak.jpg.asset.json";
import drillCoverAsset from "@/assets/album-drill.jpg.asset.json";
import afrobeatsCoverAsset from "@/assets/album-afrobeats.jpg.asset.json";
import { WelcomeBackdrop } from "@/components/layout/WelcomeBackdrop";
import { DodgyLogo } from "@/components/welcome/DodgyLogo";

function OgBotLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={ogBotAsset.url}
      alt="OG Bot"
      width={512}
      height={512}
      decoding="async"
      className={`inline-block aspect-square shrink-0 rounded-xl object-contain object-center align-middle shadow-glow ${className}`}
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

function safeRelativeNext(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return null;
  // Same-origin relative path only.
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

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
    const target = safeRelativeNext() ?? "/";
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) {
        if (target === "/") navigate({ to: "/", replace: true });
        else window.location.replace(target);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        if (target === "/") navigate({ to: "/", replace: true });
        else window.location.replace(target);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
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
        const next = safeRelativeNext();
        // Preserve `next` across a full-page OAuth round-trip so we return to
        // /welcome with the same param and can forward the user to their
        // original destination (e.g. the MCP consent URL) after sign-in.
        const redirectUri = next
          ? `${window.location.origin}/welcome?next=${encodeURIComponent(next)}`
          : window.location.origin;
        const result = await lovable.auth.signInWithOAuth(provider, {
          redirect_uri: redirectUri,
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
        if (next) window.location.replace(next);
        else navigate({ to: "/", replace: true });
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
    (d: Device, idx: number) => {
      const isPending = pending === d.provider;
      const sub = d.provider === "google" ? "Sign in with Google" : "Sign in with Apple";
      return (
        <button
          key={d.key}
          onClick={() => signIn(d.provider)}
          disabled={pending !== null}
          aria-label={`${d.label} — ${sub}`}
          style={{ ["--luxe-delay" as string]: `${idx * 0.6}s` }}
          className={`${h} ${TILE_CLASS} ${auraOn ? "luxe-glow" : ""} flex flex-col items-center justify-between gap-[clamp(0.5rem,1.2vw,0.875rem)] px-[clamp(0.5rem,1.2vw,0.875rem)] pt-[clamp(0.875rem,2vw,1.25rem)] pb-[clamp(0.5rem,1.2vw,0.875rem)] text-foreground`}
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

  const primaryTiles = useMemo(() => PRIMARY_DEVICES.map((d, i) => renderTile(d, i)), [renderTile]);

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="relative mx-auto max-w-xl overflow-hidden rounded-3xl border-2 border-primary/50 bg-linear-to-br from-primary/25 via-primary/10 to-transparent px-4 py-4 text-center shadow-[0_12px_40px_-12px_rgba(59,130,246,0.55)] sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute inset-x-0 -top-1/2 h-full animate-pulse bg-linear-to-b from-primary/20 to-transparent blur-2xl" aria-hidden />
        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-primary/60 bg-primary/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary-foreground sm:gap-2 sm:px-3 sm:text-xs sm:tracking-[0.2em]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground sm:h-5 sm:w-5 sm:text-[11px]">1</span>
          Step 1
        </span>
        <p className="relative mt-2.5 font-display text-[clamp(1.4rem,7vw,3rem)] font-black uppercase leading-[1.02] tracking-[0.01em] text-foreground sm:mt-3 sm:text-4xl sm:tracking-[0.04em] md:text-5xl">
          <span aria-hidden>👇 </span>Select Your Device
        </p>
      </div>

      <div className="landing-card-tight relative overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/[0.06] via-transparent to-transparent" aria-hidden />
        <div className="relative landing-grid">
          <div className="landing-grid grid-cols-2">{primaryTiles}</div>
          <EmailAuthPanel disabled={pending !== null} />
        </div>
      </div>
    </div>
  );
}

function EmailAuthPanel({ disabled }: { disabled?: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "reset") {
      if (!email) {
        toast.error("Enter the email you signed up with");
        return;
      }
      setBusy(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setResetSent(true);
        toast.success("Reset link sent — check your inbox.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not send the reset email");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!email || password.length < 6) {
      toast.error("Enter your email and a password of at least 6 characters");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/welcome` },
        });
        if (error) throw error;
        toast.success("Account created — check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-3xl border-2 border-primary/50 bg-card/85 p-4 shadow-[0_16px_44px_-18px_hsl(var(--primary)/0.6)] backdrop-blur-xl sm:p-6">
      {mode !== "reset" ? (
        <div className="mb-4 grid grid-cols-2 items-stretch gap-2 rounded-2xl border border-white/15 bg-black/30 p-1.5">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`font-display flex min-h-[3.75rem] min-w-0 items-center justify-center text-balance rounded-xl px-2 py-3 text-center text-[clamp(0.9rem,3.4vw,1.15rem)] font-black uppercase leading-[1.1] tracking-wide transition sm:min-h-[3.5rem] sm:px-3 ${
                mode === m
                  ? "bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_hsl(var(--primary))]"
                  : "text-foreground/70 hover:text-foreground"
              }`}
            >
              <span className="block">
                {m === "signin" ? (
                  <>
                    Sign in <span className="whitespace-nowrap">with email</span>
                  </>
                ) : (
                  <span className="whitespace-nowrap">Create account</span>
                )}
              </span>
            </button>
          ))}
        </div>

      ) : (
        <div className="mb-4 text-center">
          <p className="font-display text-[clamp(1.15rem,4.5vw,1.6rem)] font-black uppercase leading-tight text-foreground">
            Reset your password
          </p>
          <p className="mt-1 text-sm text-muted-foreground">We'll send you a secure link.</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="wc-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Email
          </Label>
          <Input
            id="wc-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 text-base"
            required
          />
        </div>
        {mode !== "reset" && (
          <div className="space-y-1.5">
            <Label htmlFor="wc-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Password
            </Label>
            <Input
              id="wc-password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-base"
              required
            />
          </div>
        )}

        {mode === "reset" && (
          <p className="text-sm text-muted-foreground">
            {resetSent
              ? "We sent a reset link. Open it on this device to set a new password — it expires shortly."
              : "We'll email you a secure link to set a new password."}
          </p>
        )}

        <Button type="submit" disabled={busy || disabled} className="h-12 w-full font-display text-base font-black uppercase tracking-wide">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : mode === "signup" ? (
            "Create account"
          ) : mode === "reset" ? (
            resetSent ? "Resend reset link" : "Send reset link"
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      {mode === "signin" && (
        <button
          type="button"
          onClick={() => { setResetSent(false); setMode("reset"); }}
          className="mt-3 w-full text-center text-sm font-semibold text-foreground/70 underline underline-offset-4 hover:text-foreground"
        >
          Forgot password?
        </button>
      )}

      {mode === "reset" && (
        <button
          type="button"
          onClick={() => { setResetSent(false); setMode("signin"); }}
          className="mt-3 w-full text-center text-sm font-semibold text-foreground/80 underline underline-offset-4 hover:text-foreground"
        >
          Back to sign in
        </button>
      )}

    </div>
  );
}







function WelcomePage() {
  // Single session check for the whole page (AuthButtons is mounted twice).
  useRedirectIfSignedIn();
  return (
    <AdminEditModeProvider>
      <main suppressHydrationWarning className="relative min-h-dvh overflow-x-hidden text-foreground">
        <WelcomeBackdrop />
        <TopNav />
        <Hero />
        <FoulMouthHype />
        <Pillars />
        
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
    <section className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col justify-center px-3 pt-6 pb-10 sm:min-h-[calc(100vh-5rem)] sm:px-8 sm:pt-10 sm:pb-16">
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

        <div className="mx-auto mb-3 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border-2 border-primary/40 bg-primary/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-primary shadow-[0_0_28px_-8px_oklch(0.7_0.2_300_/_0.7)] sm:text-sm">
          <span>🎵 MusicHUB</span>
          <span aria-hidden className="text-primary/50">·</span>
          <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-foreground">
            Powered by
            <OgBotLogo className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="font-black uppercase tracking-tight">OG Bot</span>
          </span>
        </div>

        <div className="mt-6 flex justify-center sm:mt-8">
          <DodgyLogo size={256} className="sm:[--s:320px]" />
        </div>



        <h1 className="font-display mt-5 text-[clamp(2rem,9.5vw,12rem)] font-black leading-[0.92] tracking-[-0.045em] [text-wrap:balance] hyphens-none drop-shadow-[0_8px_30px_rgba(80,60,255,0.35)] sm:mt-10 sm:leading-[0.85] sm:tracking-[-0.055em]">
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


        <div id="sign-in" className="mx-auto mt-6 max-w-md scroll-mt-24 sm:mt-14 sm:max-w-3xl">
          <AuthButtons size="xl" />
          <p className="mt-3 text-center text-sm font-semibold tracking-wide text-muted-foreground sm:mt-6 sm:text-lg sm:font-bold sm:text-foreground">
            Free to start — no card required
          </p>
        </div>





        <AlbumCoverShowcase />
      </div>


    </section>
  );
}

const PERSONAL_BANNER_KEY = "welcome.personal_banner.dismissed";

function AlbumCoverShowcase() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window !== "undefined" && localStorage.getItem(PERSONAL_BANNER_KEY) === "1") {
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { count } = await supabase
            .from("songs")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);
          if ((count ?? 0) > 0) {
            try { localStorage.setItem(PERSONAL_BANNER_KEY, "1"); } catch {}
            return;
          }
        }
        if (!cancelled) setHidden(false);
      } catch {
        if (!cancelled) setHidden(false);
      }
    })();
    const onGenerate = () => {
      try { localStorage.setItem(PERSONAL_BANNER_KEY, "1"); } catch {}
      setHidden(true);
    };
    window.addEventListener("og:generate-start", onGenerate);
    return () => {
      cancelled = true;
      window.removeEventListener("og:generate-start", onGenerate);
    };
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(PERSONAL_BANNER_KEY, "1"); } catch {}
    setHidden(true);
  }, []);

  if (hidden) return null;

  return (
    <div className="mx-auto mt-10 max-w-3xl px-1 sm:mt-16 sm:px-0">
      <div className="relative overflow-hidden rounded-[1.75rem] border-2 border-primary/40 bg-gradient-to-br from-card/80 via-card/60 to-card/80 p-5 text-center shadow-[0_18px_60px_-20px_rgba(255,60,60,0.45)] backdrop-blur-xl sm:rounded-[2rem] sm:p-8">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss personalization reminder"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-background/60 text-muted-foreground transition hover:text-foreground"
        >
          ✕
        </button>
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-primary sm:text-xs">
          ✨ Reminder
        </span>
        <h3 className="font-display mt-3 text-balance text-[clamp(1.5rem,6vw,2.25rem)] font-semibold leading-[1.05] tracking-[-0.025em] sm:mt-4 sm:text-4xl">
          Make it as personal as you like — <em className="italic text-gradient-brand">the more you share, the better the song</em>
        </h3>
        <p className="mt-3 text-sm font-medium text-muted-foreground sm:mt-4 sm:text-base">
          Names, inside jokes, occasions, favourite things — drop it all in. OG Bot turns your details into a track that feels like <em className="italic text-foreground">them</em>. 🎧
        </p>
      </div>
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



function FoulMouthHype() {
  return (
    <section className="relative border-t border-white/10">
      <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-8 sm:py-24">
        <div className="relative overflow-hidden rounded-[2.5rem] border-2 border-destructive/40 bg-gradient-to-br from-destructive/25 via-destructive/10 to-transparent p-6 shadow-[0_30px_80px_-30px_oklch(0.62_0.22_25_/_0.7)] sm:p-12">
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-destructive/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-primary/30 blur-3xl" />

          <div className="relative grid items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex items-center justify-center">
              <div className="relative">
                <span aria-hidden className="absolute -inset-3 animate-pulse rounded-full bg-destructive/30 blur-2xl" />
                <div className="relative grid h-28 w-28 place-items-center rounded-[2rem] border-2 border-destructive/60 bg-background/60 text-6xl shadow-[0_0_40px_-6px_oklch(0.62_0.22_25_/_0.8)] sm:h-36 sm:w-36 sm:text-8xl">
                  🤬
                </div>
              </div>
            </div>

            <div className="min-w-0 text-center md:text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-destructive/60 bg-destructive/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-destructive sm:text-xs">
                ⚠ Before you walk away
              </p>
              <h2 className="font-display mt-4 text-balance text-4xl font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl md:text-7xl">
                Don't forget to flip{" "}
                <span className="italic text-destructive">Foul Mouth</span> ON.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-foreground/85 sm:text-2xl">
                The clean version is cute. <span className="font-black text-foreground">Foul Mouth</span> is where{" "}
                <span className="inline-flex items-center gap-1.5 align-middle">
                  <OgBotLogo className="h-6 w-6" />
                  <span className="font-black">OG Bot</span>
                </span>{" "}
                actually goes off — savage roasts, real bars, no filter.
              </p>
              <p className="mt-4 text-base font-semibold text-muted-foreground sm:text-lg">
                Free to try. No card. One tap inside MusicHUB.
              </p>
              <div className="mt-7">
                <a
                  href="#sign-in"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-7 py-4 text-lg font-black uppercase tracking-wide text-primary-foreground shadow-glow ring-1 ring-primary/40 transition-transform hover:scale-[1.03] sm:text-xl"
                >
                  🔥 Try OG Bot free
                </a>
              </div>
            </div>
          </div>
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
          <Link
            to="/auth"
            className="inline-flex min-h-11 items-center rounded-md px-3 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
