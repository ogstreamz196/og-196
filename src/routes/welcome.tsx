import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Music2,
  MessageSquareMore,
  Bot,
  ArrowUpRight,
  PlayCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  component: WelcomePage,
  head: () => ({
    meta: [
      { title: "OG Studio — Music Hub, powered by OG Bot" },
      {
        name: "description",
        content:
          "A personal music studio. Turn real memories into finished songs with OG Bot. Sign in with Google or Apple.",
      },
      { property: "og:title", content: "OG Studio — Music Hub, powered by OG Bot" },
      {
        property: "og:description",
        content: "A personal music studio. Real stories become real songs.",
      },
    ],
  }),
});

type OAuthProvider = "google" | "apple";

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
      });
      if (result.error) {
        toast.error(result.error.message || `${provider} sign-in failed`);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setPending(null);
    }
  }
  return { signIn, pending };
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.9 2 2.8 6.1 2.8 11.9S6.9 22 12 22c6.9 0 9.4-4.9 9.4-9 0-.6-.1-1-.2-1.6H12z" />
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

function AuthButtons() {
  const { signIn, pending } = useOAuthSignIn();
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <Button
        onClick={() => signIn("google")}
        disabled={pending !== null}
        className="h-12 gap-2.5 bg-white text-black hover:bg-white/90 shadow-md transition disabled:opacity-70"
      >
        {pending === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        <span className="font-medium">Continue with Google</span>
      </Button>
      <Button
        onClick={() => signIn("apple")}
        disabled={pending !== null}
        className="h-12 gap-2.5 bg-black text-white hover:bg-black/85 border border-white/10 shadow-md transition disabled:opacity-70"
      >
        {pending === "apple" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <AppleIcon className="h-4 w-4" />
        )}
        <span className="font-medium">Continue with Apple</span>
      </Button>
    </div>
  );
}

function WelcomePage() {
  return (
    <main className="min-h-screen text-foreground">
      <TopNav />
      <Hero />
      <Pillars />
      <ClosingCta />
      <Footer />
    </main>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/welcome" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gradient-brand text-primary-foreground shadow-glow">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="leading-none">
            <p className="font-display text-base font-medium tracking-tight">OG Studio</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Music Hub
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#studio" className="transition hover:text-foreground">The Studio</a>
          <a href="#how" className="transition hover:text-foreground">How it works</a>
        </nav>

        <Link to="/auth">
          <Button size="sm" variant="outline" className="h-9 gap-1.5 border-white/15 bg-white/5 backdrop-blur">
            Sign in
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 pt-20 pb-24 sm:px-8 lg:pt-28 lg:pb-32">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs tracking-wide text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
          Music Hub · powered by OG Bot
        </div>

        <h1 className="font-display mt-8 text-[clamp(2.75rem,7vw,5.25rem)] font-light leading-[1.02] tracking-[-0.03em]">
          A personal music studio,
          <br className="hidden sm:block" />
          <em className="italic text-gradient-brand not-italic sm:italic">written from your life.</em>
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Tell OG Bot a real story — a name, a memory, a moment.
          Get back finished lyrics, a song brief, and a track ready to play.
        </p>

        <div className="mx-auto mt-10 max-w-lg">
          <AuthButtons />
          <p className="mt-4 text-xs text-muted-foreground">
            Free to start · No card required
          </p>
        </div>
      </div>

      {/* Editorial mockup card */}
      <div className="relative mx-auto mt-20 max-w-4xl">
        <div className="pointer-events-none absolute -inset-x-10 -top-10 -bottom-10 rounded-[2rem] bg-gradient-brand-soft opacity-60 blur-3xl" />
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/70 shadow-card backdrop-blur-xl">
          <div className="flex items-center gap-1.5 border-b border-white/5 px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="ml-3 text-[11px] tracking-wide text-muted-foreground">
              ogstudio.app / library
            </span>
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-5">
            <div className="sm:col-span-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <Music2 className="h-3.5 w-3.5 text-primary" />
                Music Hub
              </div>
              <div className="mt-4 space-y-2.5">
                <Track title="For Mum — 60th" mood="Soulful · Acoustic" pct={86} />
                <Track title="Liverpool nights" mood="Indie · Anthemic" pct={54} />
                <Track title="Letter to my younger self" mood="Cinematic · Ballad" pct={32} />
              </div>
            </div>
            <div className="rounded-lg border border-white/8 bg-background/40 p-4 sm:col-span-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <MessageSquareMore className="h-3.5 w-3.5 text-primary" />
                OG Bot
              </div>
              <div className="mt-4 space-y-2.5 text-[13px] leading-snug">
                <Bubble side="you">A tribute song for my grandad. He loved jazz.</Bubble>
                <Bubble side="bot">Tell me one memory of him that still makes you smile — we'll build the hook from there.</Bubble>
                <Bubble side="you">Sundays. Vinyl. Burnt toast.</Bubble>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Track({ title, mood, pct }: { title: string; mood: string; pct: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/8 bg-background/30 p-3 transition hover:border-primary/30">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-brand-soft text-primary">
        <PlayCircle className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{mood}</p>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-brand"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Bubble({ side, children }: { side: "you" | "bot"; children: React.ReactNode }) {
  const mine = side === "you";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-lg px-3 py-1.5 ${
          mine
            ? "bg-primary/90 text-primary-foreground"
            : "border border-white/8 bg-background/50 text-foreground"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Pillars() {
  const items = [
    {
      icon: <Music2 className="h-4 w-4" />,
      eyebrow: "Hub",
      title: "Music Hub",
      body: "Your studio for personalised tracks. Drafts, briefs and workspaces — calm, organised, yours.",
    },
    {
      icon: <MessageSquareMore className="h-4 w-4" />,
      eyebrow: "Messenger",
      title: "OG Messenger",
      body: "A long-form room to think out loud. Brainstorm lyrics, hooks and concepts with OG Bot.",
    },
    {
      icon: <Bot className="h-4 w-4" />,
      eyebrow: "Companion",
      title: "Floating OG Bot",
      body: "An assistant that travels with you across the app. One tap, anywhere — no context lost.",
    },
  ];

  return (
    <section id="studio" className="border-t border-white/8">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">The Studio</p>
          <h2 className="font-display mt-4 text-4xl font-light leading-tight tracking-tight sm:text-5xl">
            One assistant. <em className="italic text-muted-foreground">Three rooms.</em>
          </h2>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 md:grid-cols-3">
          {items.map((it) => (
            <article key={it.title} className="bg-card/70 p-8 backdrop-blur-xl transition hover:bg-card/85">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-brand-soft text-primary">
                  {it.icon}
                </span>
                {it.eyebrow}
              </div>
              <h3 className="font-display mt-6 text-2xl font-normal tracking-tight">{it.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section id="how" className="border-t border-white/8">
      <div className="mx-auto max-w-3xl px-5 py-28 text-center sm:px-8 lg:py-36">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Begin</p>
        <h2 className="font-display mt-5 text-4xl font-light leading-[1.05] tracking-[-0.02em] sm:text-6xl">
          Your next song
          <br />
          <em className="italic text-gradient-brand">is one story away.</em>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-base text-muted-foreground">
          Sign in. Tell OG Bot a real moment. Listen.
        </p>

        <div className="mx-auto mt-10 max-w-lg">
          <AuthButtons />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:px-8">
        <span>© {new Date().getFullYear()} OG Studio · Music Hub powered by OG Bot</span>
        <div className="flex items-center gap-6">
          <a href="#" className="transition hover:text-foreground">Privacy</a>
          <a href="#" className="transition hover:text-foreground">Terms</a>
          <Link to="/auth" className="transition hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
