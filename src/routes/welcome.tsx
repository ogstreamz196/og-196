import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Music2,
  MessageSquareMore,
  Bot,
  Sparkles,
  Loader2,
  Headphones,
  Heart,
  Star,
  Wand2,
  Mic2,
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
          "Turn real moments into real songs. Music Hub powered by OG Bot. Sign in with Google or Apple.",
      },
      { property: "og:title", content: "OG Studio — Music Hub, powered by OG Bot" },
      {
        property: "og:description",
        content: "Make a song from your life in minutes. Powered by OG Bot.",
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
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.9 2 2.8 6.1 2.8 11.9S6.9 22 12 22c6.9 0 9.4-4.9 9.4-9 0-.6-.1-1-.2-1.6H12z"
      />
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

function AuthButtons({ size = "lg" }: { size?: "lg" | "xl" }) {
  const { signIn, pending } = useOAuthSignIn();
  const h = size === "xl" ? "h-16 text-lg" : "h-14 text-base";
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      <button
        onClick={() => signIn("google")}
        disabled={pending !== null}
        className={`${h} group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-white text-black font-bold tracking-tight shadow-[0_8px_0_0_rgba(0,0,0,0.35)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_0_0_rgba(0,0,0,0.35)] active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.35)] disabled:opacity-70 disabled:cursor-wait`}
      >
        {pending === "google" ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <GoogleIcon className="h-6 w-6" />
        )}
        Continue with Google
      </button>
      <button
        onClick={() => signIn("apple")}
        disabled={pending !== null}
        className={`${h} group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-black text-white font-bold tracking-tight border border-white/15 shadow-[0_8px_0_0_rgba(255,255,255,0.08)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_0_0_rgba(255,255,255,0.1)] active:translate-y-1 active:shadow-[0_2px_0_0_rgba(255,255,255,0.08)] disabled:opacity-70 disabled:cursor-wait`}
      >
        {pending === "apple" ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <AppleIcon className="h-6 w-6" />
        )}
        Continue with Apple
      </button>
    </div>
  );
}

function WelcomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden text-foreground">
      <Blobs />
      <TopNav />
      <Hero />
      <Pillars />
      <HowItWorks />
      <ClosingCta />
      <Footer />
    </main>
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
    <section className="relative mx-auto max-w-6xl px-5 pt-14 pb-20 sm:px-8 lg:pt-24">
      {/* Floating stickers */}
      <Sticker className="left-[6%] top-8 wc-float" rotate="-12">
        <Heart className="h-5 w-5 text-pink-400" />
      </Sticker>
      <Sticker className="right-[8%] top-16 wc-float-slow" rotate="14">
        <Star className="h-5 w-5 text-amber-300" />
      </Sticker>
      <Sticker className="left-[10%] top-[55%] wc-float-slow" rotate="8">
        <Headphones className="h-5 w-5 text-primary" />
      </Sticker>
      <Sticker className="right-[6%] top-[60%] wc-float" rotate="-10">
        <Mic2 className="h-5 w-5 text-violet-300" />
      </Sticker>

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="wc-pop inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-xl">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary shadow-glow" />
          Music Hub · powered by OG Bot
        </div>

        <h1 className="font-display mt-8 text-[clamp(3.25rem,9vw,7rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
          <span className="wc-pop inline-block">Make a song</span>
          <br />
          <span className="wc-pop inline-block" style={{ animationDelay: "0.15s" }}>
            from your{" "}
          </span>
          <span
            className="wc-pop inline-block italic text-gradient-brand wc-bounce-soft"
            style={{ animationDelay: "0.3s" }}
          >
            life
          </span>
          <span className="wc-pop inline-block" style={{ animationDelay: "0.45s" }}>
            .
          </span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-muted-foreground sm:text-2xl">
          Tell <span className="font-semibold text-foreground">OG Bot</span> a real story.
          <br className="hidden sm:block" />
          Get back lyrics + a finished track. <span className="inline-block wc-wiggle">🎧</span>
        </p>

        <div className="mx-auto mt-12 max-w-2xl">
          <AuthButtons size="xl" />
          <p className="mt-5 text-sm text-muted-foreground">
            ✨ Free to start · No card required · Takes 30 seconds
          </p>
        </div>
      </div>

      {/* Chat preview card */}
      <div className="relative mx-auto mt-24 max-w-3xl">
        <div className="pointer-events-none absolute -inset-x-8 -inset-y-8 rounded-[2.5rem] bg-gradient-brand-soft opacity-60 blur-3xl" />
        <div className="relative overflow-hidden rounded-[2rem] border-2 border-white/15 bg-card/80 p-6 shadow-card backdrop-blur-xl sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-glow wc-wiggle">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">OG Bot</p>
              <p className="text-xs text-muted-foreground">online · ready to write</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-base sm:text-lg">
            <Bubble side="you">A tribute to my mum's 60th 💜</Bubble>
            <Bubble side="bot">
              Lovely. Give me one memory of her that still makes you smile.
            </Bubble>
            <Bubble side="you">Sunday roasts. Singing Tina Turner in the kitchen.</Bubble>
            <Bubble side="bot">
              <span className="inline-flex items-center gap-1.5">
                <Wand2 className="h-4 w-4" /> Cooking up your song…
              </span>
            </Bubble>
          </div>
        </div>
      </div>
    </section>
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

function Bubble({ side, children }: { side: "you" | "bot"; children: React.ReactNode }) {
  const mine = side === "you";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-2.5 leading-snug shadow-md ${
          mine
            ? "rounded-br-md bg-gradient-brand text-primary-foreground"
            : "rounded-bl-md border border-white/10 bg-background/70 text-foreground"
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
      icon: <Music2 className="h-6 w-6" />,
      emoji: "🎵",
      title: "Music Hub",
      body: "Your home for personalised songs. Drafts, briefs and workspaces — all in one happy place.",
      tilt: "-2",
    },
    {
      icon: <MessageSquareMore className="h-6 w-6" />,
      emoji: "💬",
      title: "OG Messenger",
      body: "A long-form room to think out loud. Brainstorm lyrics, hooks and concepts with OG Bot.",
      tilt: "1.5",
    },
    {
      icon: <Bot className="h-6 w-6" />,
      emoji: "🤖",
      title: "Floating OG Bot",
      body: "A companion that follows you everywhere. One tap, anywhere — never lose your thread.",
      tilt: "-1",
    },
  ];

  return (
    <section id="studio" className="relative">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">
            The Studio
          </p>
          <h2 className="font-display mt-4 text-5xl font-semibold leading-tight tracking-[-0.03em] sm:text-6xl">
            One bot. <em className="italic text-gradient-brand">Three rooms.</em>
          </h2>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {items.map((it) => (
            <article
              key={it.title}
              style={{ transform: `rotate(${it.tilt}deg)` }}
              className="group relative rounded-3xl border-2 border-white/12 bg-card/80 p-8 backdrop-blur-xl transition-all duration-200 hover:-translate-y-2 hover:rotate-0 hover:border-primary/40 hover:shadow-glow"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6">
                  {it.icon}
                </span>
                <span className="text-3xl">{it.emoji}</span>
              </div>
              <h3 className="font-display mt-6 text-3xl font-semibold tracking-tight">
                {it.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{it.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1", emoji: "👋", title: "Sign in", body: "Google or Apple. Two taps, you're in." },
    { n: "2", emoji: "✍️", title: "Tell OG a story", body: "A name. A memory. A moment that matters." },
    { n: "3", emoji: "🎶", title: "Get your song", body: "Lyrics + a finished track, ready to play." },
  ];
  return (
    <section className="relative border-t border-white/10">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">
            How it works
          </p>
          <h2 className="font-display mt-4 text-5xl font-semibold tracking-[-0.03em] sm:text-6xl">
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
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-brand text-3xl font-black text-primary-foreground shadow-glow wc-bounce-soft">
                {s.n}
              </div>
              <div className="mt-5 text-5xl">{s.emoji}</div>
              <h3 className="font-display mt-3 text-2xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-base text-muted-foreground">{s.body}</p>
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
          Begin
        </p>
        <h2 className="font-display mt-5 text-6xl font-semibold leading-[1] tracking-[-0.04em] sm:text-7xl">
          Your next song
          <br />
          <em className="italic text-gradient-brand wc-bounce-soft inline-block">
            is one story away.
          </em>
        </h2>
        <p className="mx-auto mt-7 max-w-xl text-xl text-muted-foreground">
          Sign in. Tell OG Bot a moment. Hit play. <span className="inline-block wc-wiggle">🎉</span>
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
        <span>© {new Date().getFullYear()} OG Studio · Music Hub powered by OG Bot</span>
        <div className="flex items-center gap-6">
          <Link to="/auth" className="transition hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
