import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkValid, setLinkValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) {
        setLinkValid(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setLinkValid(Boolean(data.session));
      setReady(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated");
      setTimeout(() => navigate({ to: "/" }), 1800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border-2 border-primary/40 bg-primary/15">
          <KeyRound className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h1 className="font-display text-[clamp(1.75rem,7vw,2.5rem)] font-black uppercase leading-tight tracking-tight text-foreground">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a new password for your OG Streamz account.
        </p>
      </header>

      <section className="rounded-3xl border-2 border-white/15 bg-white/[0.04] p-5">
        {!ready ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden />
            <p className="font-display text-lg font-black uppercase tracking-wide text-foreground">
              Password updated
            </p>
            <p className="text-sm text-muted-foreground">Taking you into the app…</p>
          </div>
        ) : !linkValid ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a fresh one from the sign-in page.
            </p>
            <Button asChild className="h-12 w-full font-display font-black uppercase tracking-wide">
              <Link to="/welcome">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rp-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                New password
              </Label>
              <Input
                id="rp-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-confirm" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Confirm password
              </Label>
              <Input
                id="rp-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12 text-base"
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="h-12 w-full font-display text-base font-black uppercase tracking-wide">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Update password"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset your password | OG Streamz" },
      {
        name: "description",
        content: "Set a new password for your OG Streamz account using the secure reset link we emailed you.",
      },
      { property: "og:title", content: "Reset your password | OG Streamz" },
      {
        property: "og:description",
        content: "Set a new password for your OG Streamz account using the secure reset link we emailed you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
