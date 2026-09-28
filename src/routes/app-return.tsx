import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

function AppReturn() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("next");
    const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      window.location.replace(next);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go();
    });
    supabase.auth.getSession().then(({ data }) => data.session && go());
    const t = setTimeout(go, 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 text-center">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  );
}
