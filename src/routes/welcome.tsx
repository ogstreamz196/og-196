import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Music2,
  MessageSquareMore,
  Bot,
  ArrowRight,
  Heart,
  Cake,
  Flame,
  BookOpen,
  Users,
  Headphones,
  PlayCircle,
  Wand2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

function AuthButtons({ size = "lg" }: { size?: "lg" | "default" }) {
  const { signIn, pending } = useOAuthSignIn();
  const h = size === "lg" ? "h-14 text-base" : "h-12 text-sm";
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
      <Button
        onClick={() => signIn("google")}
        disabled={pending !== null}
        size={size}
        className={`${h} gap-2.5 px-6 font-bold bg-white text-black hover:bg-white/90 shadow-lg transition hover:scale-[1.02]`}
      >
        {pending === "google" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GoogleIcon className="h-5 w-5" />
        )}
        Sign in with Google
      </Button>
      <Button
        onClick={() => signIn("apple")}
        disabled={pending !== null}
        size={size}
        className={`${h} gap-2.5 px-6 font-bold bg-black text-white hover:bg-black/85 shadow-lg transition hover:scale-[1.02]`}
      >
        {pending === "apple" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <AppleIcon className="h-5 w-5" />
        )}
        Sign in with Apple
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/welcome")({
  ssr: false,
  component: WelcomePage,
  head: () => ({
    meta: [
      { title: "OG Studio — Make a song about anyone you love" },
      {
        name: "description",
        content:
          "Turn real memories into real songs. Tap an idea, tell OG Bot the story, get a song. That's it.",
      },
      { property: "og:title", content: "OG Studio — Make a song about anyone you love" },
      {
        property: "og:description",
        content: "Tap an idea. Tell the story. Get a song. Powered by OG Bot.",
      },
    ],
  }),
});

const IDEAS = [
  { emoji: "🎂", label: "Mum's birthday", hint: "A song that'll make her cry (the good kind)" },
  { emoji: "❤️", label: "For my partner", hint: "Your story. Not a generic love song." },
  { emoji: "👶", label: "For my kid", hint: "Something they'll keep forever." },
  { emoji: "🕊️", label: "Tribute to someone", hint: "Honour them with their real story." },
  { emoji: "🔥", label: "My own anthem", hint: "A song about who you are right now." },
  { emoji: "💍", label: "Wedding song", hint: "The first dance, written for you two." },
];

function WelcomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <BackgroundFx />
      <TopNav />
      <Hero />
      <IdeaPlayground />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </main>
  );
}

function BackgroundFx() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-[720px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.22),transparent_70%)] blur-3xl" />
      <div className="absolute bottom-[-220px] right-[-140px] h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--accent)/0.2),transparent_70%)] blur-3xl animate-pulse" />
      <div className="absolute top-1/3 left-[-120px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.12),transparent_70%)] blur-3xl" />
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/welcome" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-base font-bold tracking-tight">OG Studio</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
              Sign in
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="gap-1.5 font-semibold">
              Let's go
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

const HERO_WORDS = ["someone you love", "your mum", "your best mate", "your kid", "your story"];

function Hero() {
  const [wordIdx, setWordIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setWordIdx((i) => (i + 1) % HERO_WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative mx-auto max-w-5xl px-4 pt-12 pb-12 text-center sm:px-6 lg:pt-20">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-bold backdrop-blur">
        <Music2 className="h-4 w-4 text-primary" />
        Music Hub · powered by OG Bot 🤖
      </div>

      <h1 className="mt-7 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
        Make a song
        <br />
        about{" "}
        <span
          key={wordIdx}
          className="inline-block bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          {HERO_WORDS[wordIdx]}
        </span>
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
        Welcome to the <span className="font-bold text-foreground">Music Hub</span> — your AI music
        studio. Sign in and start your first song in seconds. 🎶
      </p>

      <div className="mx-auto mt-9 max-w-xl">
        <AuthButtons size="lg" />
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        Free to try • No card needed • One tap to start
      </p>
    </section>
  );
}

function IdeaPlayground() {
  const [picked, setPicked] = useState<number | null>(null);
  const active = useMemo(() => (picked != null ? IDEAS[picked] : null), [picked]);

  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <div className="rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur sm:p-10">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Try it — pick an idea 👇
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            What song do you want to make?
          </h2>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {IDEAS.map((idea, i) => {
            const isActive = picked === i;
            return (
              <button
                key={idea.label}
                onClick={() => setPicked(i)}
                className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:scale-[1.02] hover:shadow-lg ${
                  isActive
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                    : "border-border/60 bg-card/60 hover:border-primary/50"
                }`}
              >
                <span className="text-3xl transition-transform group-hover:scale-125 group-hover:rotate-6">
                  {idea.emoji}
                </span>
                <div className="min-w-0">
                  <p className="text-base font-bold">{idea.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{idea.hint}</p>
                </div>
              </button>
            );
          })}
        </div>

        {active && (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center animate-in fade-in slide-in-from-bottom-3 duration-500">
            <p className="text-lg font-semibold">
              <span className="text-2xl mr-2">{active.emoji}</span>
              Nice pick. Let's write "{active.label}" together.
            </p>
            <Link to="/auth">
              <Button size="lg" className="h-12 gap-2 px-6 font-bold">
                <PlayCircle className="h-5 w-5" />
                Start this song
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      emoji: "💬",
      icon: <BookOpen className="h-5 w-5" />,
      title: "Tell the story",
      body: "Names, memories, inside jokes. The real stuff.",
    },
    {
      emoji: "🪄",
      icon: <Wand2 className="h-5 w-5" />,
      title: "OG Bot writes it",
      body: "Lyrics, mood, vibe — shaped from your words.",
    },
    {
      emoji: "🎧",
      icon: <Headphones className="h-5 w-5" />,
      title: "Hear your song",
      body: "Get a ready-to-play song brief. Press go.",
    },
  ];

  return (
    <section className="border-t border-border/40 bg-card/20">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            How it works
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">Three steps. That's the whole thing.</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-7 transition hover:scale-[1.03] hover:border-primary/50 hover:shadow-xl"
            >
              <div className="absolute right-4 top-4 text-5xl opacity-20 transition group-hover:opacity-100 group-hover:scale-110">
                {s.emoji}
              </div>
              <span className="relative text-xs font-bold text-primary">STEP 0{i + 1}</span>
              <h3 className="relative mt-3 text-2xl font-bold tracking-tight">{s.title}</h3>
              <p className="relative mt-2 text-base leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-border/40">
      <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/80 via-card/60 to-card/80 p-10 text-center shadow-2xl backdrop-blur sm:p-16">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-[140%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.3),transparent_70%)] blur-3xl" />

          <div className="relative">
            <div className="flex justify-center gap-2 text-4xl">
              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>🎤</span>
              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>🎶</span>
              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>✨</span>
            </div>
            <h2 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
              Your song is waiting.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Sign in and let's make something they'll never forget.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-14 gap-2 px-8 text-base font-bold shadow-lg shadow-primary/20 transition hover:scale-[1.03]">
                  Continue with Google
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="h-14 gap-2 px-8 text-base font-semibold transition hover:scale-[1.03]">
                  Continue with Apple
                </Button>
              </Link>
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              No passwords. No spam. Just songs.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Sparkles className="h-3 w-3" />
          </span>
          <span>© {new Date().getFullYear()} OG Studio · Made with 🎶 by OG Bot</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="#" className="transition hover:text-foreground">Privacy</a>
          <a href="#" className="transition hover:text-foreground">Terms</a>
          <Link to="/auth" className="transition hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}

// Silence unused icon imports (kept for potential future use)
void Music2; void Bot; void Heart; void Cake; void Flame; void Users;
