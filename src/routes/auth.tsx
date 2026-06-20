import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, Music2, MessageSquareMore, Sparkles, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const searchSchema = z.object({ redirect: z.string().optional().catch("/") });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — OG Studio" },
      {
        name: "description",
        content:
          "Sign in to OG Studio — your personalised music creation platform with Music Hub, OG Messenger, and a floating AI assistant.",
      },
    ],
  }),
});

type Provider = "google" | "apple";

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: (search.redirect as "/") ?? "/", replace: true });
    });
  }, [navigate, search.redirect]);

  async function handleOAuth(provider: Provider) {
    setError(null);
    setPending(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
        extraParams: provider === "google" ? { prompt: "select_account" } : undefined,
      });
      if (result.error) {
        const msg = result.error.message || `${provider === "apple" ? "Apple" : "Google"} sign-in failed`;
        setError(msg);
        toast.error(msg);
        return;
      }
      if (result.redirected) return;
      navigate({ to: (search.redirect as "/") ?? "/", replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* Pitch */}
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border/50 p-12 lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.15),transparent_55%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Personalised music creation, reimagined
            </div>
            <h1 className="mt-8 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Make music that sounds like <span className="text-primary">you</span>.
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground">
              Type a prompt, choose a style, then turn jokes, memories and moods into finished tracks.
            </p>
          </div>

          <ul className="relative mt-12 space-y-5">
            <Feature
              icon={<Music2 className="h-4 w-4" />}
              title="Prompt songs"
              body="Start with a lyric idea, birthday message, love story or wild voice-note vibe."
            />
            <Feature
              icon={<MessageSquareMore className="h-4 w-4" />}
              title="Different styles"
              body="Make rap, drill, pop, afrobeats, R&B, dance tracks, sad ballads and hype anthems."
            />
            <Feature
              icon={<Sparkles className="h-4 w-4" />}
              title="Album cover energy"
              body="Every idea feels like a real drop with colourful artwork and a playable song."
            />
          </ul>

          <p className="relative mt-12 text-xs text-muted-foreground">
            © {new Date().getFullYear()} OG Studio. Sign in to start creating.
          </p>
        </section>

        {/* Auth card */}
        <section className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to access Music Hub, OG Messenger and your assistant.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => handleOAuth("google")}
                disabled={pending !== null}
                className="h-11 w-full justify-center gap-3 bg-foreground text-background hover:bg-foreground/90"
              >
                {pending === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                  Sign in with Google
              </Button>

              <Button
                onClick={() => handleOAuth("apple")}
                disabled={pending !== null}
                variant="outline"
                className="h-11 w-full justify-center gap-3"
              >
                {pending === "apple" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AppleIcon />
                )}
                Continue with Apple
              </Button>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <div className="mt-8 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                By continuing, you agree to our Terms and acknowledge our Privacy Policy.
                No passwords. No spam.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-card/60 text-primary">
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.3 4.5 9.7 8.8 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.7-2 13.2-5.2l-6.1-5c-1.9 1.3-4.3 2.2-7.1 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39.1 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.1 5c-.4.4 6.7-4.9 6.7-14.4 0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.43 2.22-1.21 3.02-.84.87-2.19 1.55-3.3 1.46-.13-1.09.43-2.24 1.16-3 .82-.86 2.24-1.5 3.35-1.48zM20.5 17.27c-.55 1.27-.82 1.84-1.53 2.97-.98 1.57-2.36 3.53-4.07 3.54-1.52.02-1.91-.99-3.97-.98-2.06.01-2.49 1-4.01.98-1.71-.02-3.02-1.78-4-3.35C.27 16.13-.04 11.6 1.78 8.9c1.3-1.93 3.35-3.06 5.27-3.06 1.96 0 3.19 1.07 4.8 1.07 1.57 0 2.52-1.07 4.78-1.07 1.71 0 3.52.93 4.81 2.54-4.23 2.32-3.54 8.37-.94 8.89z" />
    </svg>
  );
}
