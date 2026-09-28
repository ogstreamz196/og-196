import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app-return")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — OG BOT" },
      { name: "description", content: "Finishing sign-in and returning you to OG BOT." },
      { property: "og:title", content: "Signing you in — OG BOT" },
      { property: "og:description", content: "Finishing sign-in and returning you to OG BOT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppReturn,
});

export function AppReturn() {
  const [sessionReady, setSessionReady] = useState(false);
  const [native, setNative] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const isNative = Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
    setNative(isNative);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setSessionReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
      else setError("Sign-in did not finish. Please try again.");
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const raw = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
  const next = raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  useEffect(() => {
    if (native && sessionReady) window.location.replace(next);
  }, [native, sessionReady, next]);

  async function returnToApp() {
    setError("");
    setOpening(true);
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session) {
      setOpening(false);
      setError("Sign-in did not finish. Please try again.");
      return;
    }
    // Chrome's explicit package intent opens the installed app even when Android
    // has not verified its website links. Tokens go only to that app, not the web fallback.
    const url = new URL("https://ogbot.co.uk/app-return");
    url.searchParams.set("next", next);
    url.searchParams.set("access_token", data.session.access_token);
    url.searchParams.set("refresh_token", data.session.refresh_token);
    const fallback = encodeURIComponent(`${window.location.origin}/sign-in-return${window.location.search}`);
    window.location.href = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=uk.co.ogbot.app;S.browser_fallback_url=${fallback};end`;
    // If no compatible app is installed Chrome returns to this page.
    window.setTimeout(() => setOpening(false), 2500);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <p className="text-foreground">{sessionReady ? "Signed in to OG BOT" : "Finishing sign-in…"}</p>
        {!native && sessionReady && (
          <>
            <Button onClick={returnToApp} disabled={opening}>Open OG BOT app</Button>
            <a href={next} className="text-sm text-muted-foreground underline">Continue in browser</a>
          </>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {error && <a href="/welcome" className="text-sm text-muted-foreground underline">Try signing in again</a>}
      </div>
    </div>
  );
}
