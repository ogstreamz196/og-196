import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Loader2,
  ShieldCheck,
  Sparkles,
  Globe2,
  Code2,
  Cpu,
  MessageSquareMore,
  Flame,
  ArrowRight,
  Music2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ogLogoAsset from "@/assets/og-logo.png.asset.json";

const searchSchema = z.object({ redirect: z.string().optional().catch("/") });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "OG Bot — The Foul-Mouthed AI Assistant You Can Embed Anywhere" },
      {
        name: "description",
        content:
          "Meet OG Bot: an AI with attitude, total recall, and zero filter. Drop a single script on your site and let him handle the heavy lifting.",
      },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      navigate({ to: search.redirect ?? ("/" as never), replace: true });
    } finally {
      setLoading(false);
    }
  }

  function scrollToAuth() {
    document.getElementById("get-access")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="relative min-h-screen w-full">
      {/* Top nav / branding */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-4 md:px-10">
        <div className="flex items-center gap-3 rounded-2xl glass-panel px-3 py-2">
          <img
            src={ogLogoAsset.url}
            alt="OG Bot"
            className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/15"
          />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide text-foreground">OG BOT</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              OG Streamz · Music Hub
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex text-foreground/80 hover:text-foreground"
            onClick={scrollToAuth}
          >
            Log in
          </Button>
          <Button
            size="sm"
            onClick={scrollToAuth}
            className="bg-gradient-brand shadow-glow font-semibold"
          >
            Sign up <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pt-10 pb-16 md:pt-20 md:pb-24">
        <div className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Flame className="h-3.5 w-3.5" />
              New · OG Bot Floating Widget
            </div>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
              Meet the{" "}
              <span className="text-gradient-brand">OG Bot</span>:<br />
              The Foul-Mouthed, No-B.S.{" "}
              <span className="text-gradient-metal">Personal Assistant</span>{" "}
              You Can Embed Anywhere.
            </h1>
            <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
              An AI with attitude, total recall, and zero filter. Hook it up to your site as a
              floating widget, link your tools, and let it handle the heavy lifting while keeping it{" "}
              <span className="font-semibold text-foreground">100% real</span>.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={scrollToAuth}
                className="bg-gradient-brand text-base font-bold shadow-glow"
              >
                Deploy the OG Bot Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={scrollToAuth}
                className="glass-panel border-white/15 text-foreground hover:bg-white/5"
              >
                <Music2 className="mr-2 h-4 w-4" />
                Enter the Music Hub Portal
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Google sign-in
              </span>
              <span>· 10 starter OG coins on signup</span>
              <span>· One script tag to deploy</span>
            </div>
          </div>

          {/* Widget mockup */}
          <div className="relative">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl glass-panel-strong shadow-glow">
              {/* Faux browser chrome */}
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 truncate rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                  yoursite.com
                </span>
              </div>
              {/* Faux page content */}
              <div className="relative h-[calc(100%-2.5rem)] p-5">
                <div className="space-y-2">
                  <div className="h-3 w-1/2 rounded bg-white/10" />
                  <div className="h-3 w-2/3 rounded bg-white/10" />
                  <div className="h-3 w-1/3 rounded bg-white/10" />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="h-24 rounded-xl bg-white/5" />
                  <div className="h-24 rounded-xl bg-white/5" />
                  <div className="h-24 rounded-xl bg-white/5" />
                  <div className="h-24 rounded-xl bg-white/5" />
                </div>

                {/* Floating widget bubble */}
                <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
                  <div className="max-w-[14rem] rounded-2xl rounded-br-sm glass-panel-strong px-3 py-2 text-xs text-foreground shadow-glow">
                    <span className="font-semibold text-primary">OG Bot:</span> Yo, drop the link
                    and I'll crawl it. Don't make me ask twice.
                  </div>
                  <button
                    type="button"
                    className="group relative grid h-16 w-16 place-items-center rounded-full bg-gradient-brand shadow-glow ring-2 ring-white/20 transition-transform hover:scale-105"
                    aria-label="OG Bot floating widget"
                  >
                    <img
                      src={ogLogoAsset.url}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-[10px] font-bold text-emerald-950 ring-2 ring-background">
                      1
                    </span>
                  </button>
                </div>
              </div>
            </div>
            {/* Glow halo */}
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-brand opacity-20 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">Built different. On purpose.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Three reasons OG Bot eats every polite chatbot for breakfast.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<MessageSquareMore className="h-5 w-5" />}
            title="Zero Filter Personality"
            body="Foul-mouthed, hilariously authentic, and somehow still brilliant. Talks to your visitors like a real human, not a sanitised corporate parrot."
          />
          <FeatureCard
            icon={<Globe2 className="h-5 w-5" />}
            title="Sitewide Integration"
            body="Copy a single script tag and his floating widget lives on every page — a personal assistant ready to roast, help, or sell, 24/7."
          />
          <FeatureCard
            icon={<Cpu className="h-5 w-5" />}
            title="Power Capabilities Hard-Wired"
            body="Web crawling, image analysis, and code execution running in the background. He doesn't just chat — he ships."
          />
        </div>

        {/* Code snippet teaser */}
        <div className="mt-8 overflow-hidden rounded-2xl glass-panel">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs">
            <span className="inline-flex items-center gap-2 font-mono text-muted-foreground">
              <Code2 className="h-3.5 w-3.5" /> embed.html
            </span>
            <span className="rounded bg-primary/15 px-2 py-0.5 font-semibold uppercase tracking-wider text-primary">
              One line
            </span>
          </div>
          <pre className="overflow-x-auto px-4 py-4 text-sm font-mono text-foreground/90">
            <code>{`<script src="https://ogstreamz.co.uk/widget.js" data-bot="og" async></script>`}</code>
          </pre>
        </div>
      </section>

      {/* Auth / Get Access */}
      <section
        id="get-access"
        className="mx-auto max-w-2xl px-4 pb-24"
      >
        <div className="rounded-3xl glass-panel-strong p-8 shadow-glow md:p-10">
          <div className="mb-6 flex items-center justify-center gap-3">
            <img
              src={ogLogoAsset.url}
              alt="OG Bot"
              className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/15"
            />
            <div className="text-left">
              <div className="text-xs uppercase tracking-[0.25em] text-primary">Get Access Now</div>
              <div className="text-lg font-bold">Sign up to meet the OG Bot</div>
            </div>
          </div>

          <h3 className="text-center text-2xl font-bold">One click. You're in.</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sign in with Google to deploy the widget, jump into the Music Hub, and claim your
            starter OG coins. Boss access is granted automatically to the authorised owner email.
          </p>

          <Button
            type="button"
            className="mt-7 w-full bg-gradient-brand text-base font-bold shadow-glow"
            size="lg"
            onClick={handleGoogle}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#fff"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#fff"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  opacity="0.85"
                />
                <path
                  fill="#fff"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22z"
                  opacity="0.7"
                />
                <path
                  fill="#fff"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  opacity="0.55"
                />
              </svg>
            )}
            Deploy the OG Bot — Continue with Google
          </Button>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              New accounts get 10 starter OG coins. We only use Google for identity verification —
              no spam, no nonsense.
            </span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already a member? Same button — sign in with Google to drop straight into your Music Hub.
        </p>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-2xl glass-panel p-5 transition-transform hover:-translate-y-0.5">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow">
        {icon}
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
