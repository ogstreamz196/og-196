import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Loader2,
  ShieldCheck,
  Globe2,
  Code2,
  Cpu,
  MessageSquareMore,
  Flame,
  ArrowRight,
  Music2,
  Brain,
  Send,
  X,
  Check,
  Copy,
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
          "Deploy OG Bot — an AI with attitude, total recall, and zero filter — as a floating widget on any site in seconds.",
      },
    ],
  }),
});

const EMBED_SNIPPET = `<script src="https://cdn.ogstreamz.co.uk/widget.js" data-bot-id="og-bot"></script>`;

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const authAnchor = useRef<HTMLDivElement>(null);

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

  async function handlePortal() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      navigate({ to: "/", replace: true });
    } else {
      scrollToAuth();
    }
  }

  function scrollToAuth() {
    authAnchor.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(EMBED_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Select and copy manually.");
    }
  }

  return (
    <div className="relative min-h-screen w-full">
      {/* HEADER */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-4 md:px-10">
        <div className="flex items-center gap-3 rounded-2xl glass-panel px-3 py-2">
          <div className="relative">
            <img
              src={ogLogoAsset.url}
              alt="OG Bot"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/60"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background" />
          </div>
          <div className="leading-tight">
            <div
              className="text-sm font-black uppercase tracking-[0.18em] text-foreground"
              style={{ textShadow: "0 0 18px oklch(0.62 0.20 268 / 0.85)" }}
            >
              OG BOT
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              OG Streamz · Music Hub
            </div>
          </div>
        </div>
        <Button
          onClick={scrollToAuth}
          className="glass-panel border border-white/15 bg-white/5 font-semibold text-foreground hover:bg-white/10"
        >
          Sign In / Sign Up
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </header>

      {/* HERO */}
      <section className="relative mx-auto max-w-6xl px-4 pt-8 pb-16 md:pt-16 md:pb-24">
        <div className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Flame className="h-3.5 w-3.5" />
              New · OG Bot Floating Widget
            </div>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
              Meet the <span className="text-gradient-brand">OG Bot</span>:<br />
              The Foul-Mouthed, No-B.S.{" "}
              <span className="text-gradient-metal">Personal Assistant</span> You Can Embed
              Anywhere.
            </h1>
            <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
              An AI assistant with a serious attitude, total recall, and zero filter. Deploy him to
              run background tasks, write code, or talk back to your users.
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
                onClick={handlePortal}
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
          <WidgetMockup open={widgetOpen} setOpen={setWidgetOpen} />
        </div>
      </section>

      {/* FEATURES */}
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
            body="Hilariously authentic, foul-mouthed, and brutally honest — built to stand out from corporate AI clones."
          />
          <FeatureCard
            icon={<Cpu className="h-5 w-5" />}
            title="Hard-Wired Background Engine"
            body="Web crawling, deep image analysis, automated code execution, and data scraping run 24/7 silently behind the scenes."
          />
          <FeatureCard
            icon={<Brain className="h-5 w-5" />}
            title="Total Recall Memory"
            body="Never forgets a pattern, an event, or a user preference — adapts instantly to repeat workflows."
          />
        </div>
      </section>

      {/* EMBED SNIPPET */}
      <section className="mx-auto max-w-4xl px-4 pb-16 md:pb-24">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <Globe2 className="h-3.5 w-3.5" /> One-line install
          </div>
          <h2 className="mt-4 text-2xl font-bold md:text-3xl">Deploy Sitewide in 2 Seconds</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Drop this script into your site's <code className="rounded bg-white/5 px-1">&lt;head&gt;</code>. That's it. He's live everywhere.
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl glass-panel-strong shadow-glow">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs">
            <span className="inline-flex items-center gap-2 font-mono text-muted-foreground">
              <Code2 className="h-3.5 w-3.5" /> embed.html
            </span>
            <Button
              size="sm"
              onClick={copyEmbed}
              className={
                copied
                  ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/25"
                  : "bg-gradient-brand text-primary-foreground shadow-glow"
              }
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-4 w-4" /> Copy
                </>
              )}
            </Button>
          </div>
          <pre className="overflow-x-auto px-5 py-5 text-sm font-mono leading-relaxed">
            <code>
              <span className="text-muted-foreground">&lt;</span>
              <span className="text-primary">script</span>{" "}
              <span className="text-emerald-300">src</span>=
              <span className="text-amber-200">
                "https://cdn.ogstreamz.co.uk/widget.js"
              </span>{" "}
              <span className="text-emerald-300">data-bot-id</span>=
              <span className="text-amber-200">"og-bot"</span>
              <span className="text-muted-foreground">&gt;&lt;/</span>
              <span className="text-primary">script</span>
              <span className="text-muted-foreground">&gt;</span>
            </code>
          </pre>
        </div>
      </section>

      {/* CTA + AUTH ANCHOR */}
      <section ref={authAnchor} className="mx-auto max-w-3xl px-4 pb-24">
        <div className="rounded-3xl glass-panel-strong p-8 shadow-glow md:p-12">
          <h2 className="text-center text-3xl font-black md:text-4xl">
            Ready to unleash the <span className="text-gradient-brand">OG Bot</span>?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
            Pick your lane. New here? Deploy the bot. Returning? Drop straight into the Music Hub.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              onClick={handleGoogle}
              disabled={loading}
              className="bg-gradient-brand text-base font-bold shadow-glow"
            >
              Deploy the OG Bot Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleGoogle}
              disabled={loading}
              className="glass-panel border-white/15 text-foreground hover:bg-white/5"
            >
              <Music2 className="mr-2 h-4 w-4" />
              Enter the Music Hub Portal
            </Button>
          </div>

          <div className="mt-7 flex flex-col items-center">
            <div className="mb-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              <span className="h-px w-12 bg-white/15" />
              Sign in or sign up
              <span className="h-px w-12 bg-white/15" />
            </div>

            <Button
              type="button"
              size="lg"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full max-w-sm glass-panel border border-white/15 bg-white/5 text-base font-semibold text-foreground hover:bg-white/10"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Continue with Google
            </Button>

            <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Google identity only. New accounts get 10 starter OG coins. Boss access goes to the
                authorised owner email.
              </span>
            </div>
          </div>
        </div>
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

type Msg = { from: "bot" | "user"; text: string };
const DEMO_CONVO: Msg[] = [
  { from: "user", text: "What can you actually do?" },
  {
    from: "bot",
    text: "Crawl the web, read your images, run code, remember every dumb thing you've ever asked me. Want a list or you just gonna keep stalling?",
  },
  { from: "user", text: "Damn. Okay, summarise my last support ticket." },
  {
    from: "bot",
    text: "Done. User's mad about checkout. Refund'em, send the apology, move on. Want me to draft it?",
  },
];

function WidgetMockup({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  return (
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

          {/* Floating widget bubble + chat window */}
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-3">
            {open && (
              <div className="w-[16rem] origin-bottom-right animate-in fade-in slide-in-from-bottom-2 overflow-hidden rounded-2xl glass-panel-strong shadow-glow duration-200">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={ogLogoAsset.url}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover ring-1 ring-primary/60"
                    />
                    <div className="leading-tight">
                      <div className="text-xs font-bold">OG Bot</div>
                      <div className="text-[9px] uppercase tracking-wider text-emerald-300">
                        ● Online · zero filter
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto px-3 py-3">
                  {DEMO_CONVO.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={
                          m.from === "user"
                            ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-2.5 py-1.5 text-[11px] text-primary-foreground"
                            : "max-w-[85%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-foreground"
                        }
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 border-t border-white/10 px-2 py-2">
                  <div className="flex-1 truncate rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-muted-foreground">
                    Type something…
                  </div>
                  <button className="grid h-7 w-7 place-items-center rounded-md bg-gradient-brand text-primary-foreground shadow-glow">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="group relative grid h-16 w-16 place-items-center rounded-full bg-gradient-brand shadow-glow ring-2 ring-white/20 transition-transform hover:scale-105"
              aria-label="Open OG Bot widget"
            >
              <img
                src={ogLogoAsset.url}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
              {!open && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-[10px] font-bold text-emerald-950 ring-2 ring-background">
                  1
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Glow halo */}
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-brand opacity-20 blur-3xl" />
    </div>
  );
}
