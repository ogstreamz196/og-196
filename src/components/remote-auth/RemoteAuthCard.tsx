import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useRemoteAuth } from "@/hooks/use-remote-auth";

export function RemoteAuthCard() {
  const { user, isLoading, signInWithPassword, signUpWithPassword, signOut } =
    useRemoteAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } =
        mode === "signin"
          ? await signInWithPassword(email, password)
          : await signUpWithPassword(email, password);
      if (error) toast.error(error.message);
      else toast.success(mode === "signin" ? "Signed in to OG Bot project." : "Check your email to confirm.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">OG Bot account (remote project)</h3>
        <Badge variant="outline" className="text-[10px]">dawcdietltejjxbdimkm</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking session…
        </div>
      ) : user ? (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs">
            <div className="font-medium">{user.email}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{user.id}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => signOut()}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      ) : (
        <>
          <form onSubmit={handlePassword} className="space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="ra-email" className="text-xs">Email</Label>
              <Input
                id="ra-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ra-password" className="text-xs">Password</Label>
              <Input
                id="ra-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button size="sm" type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogIn className="mr-1.5 h-3.5 w-3.5" />}
                {mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
              <button
                type="button"
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline"
                onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
              >
                {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
              </button>
            </div>
          </form>
          <p className="text-[10px] text-muted-foreground">
            This logs you into the remote OG Bot project so this site can read your tokens,
            persona, and language preferences. It does NOT change your local site login.
          </p>
        </>
      )}
    </Card>
  );
}
