import { createFileRoute, Navigate, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot, Loader2, ShieldCheck, Copy, RotateCcw, Trash2, Search, ArrowLeft, Eye, EyeOff, Lock, KeyRound, Code2, CalendarClock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// How long a successful re-auth keeps reveal/copy unlocked, in ms.
const REAUTH_TTL_MS = 5 * 60 * 1000;

const EMBED_LOADER_URL = "https://ogstreamz.lovable.app/api/public/og-bot-widget-embed.js";

function buildEmbedPrompt(token: string): string {
  return `Embed the OG Bot widget into this project

You are adding the OG Bot chat widget. The bot's brain — language, foul-mouth dictionary, voice, persona, intelligence, swear lexicon and all upgrade logic — lives only on the mother backend and is collectively called OG Bot Code. It is private. You do not see it, copy it, store it, or reimplement any of it here. The latest boss-approved version is inherited automatically within ~60 seconds of approval.

1. Where to point — one backend, hardcoded

Hardcode this loader URL. Do NOT make it configurable, do NOT proxy through your own backend, do NOT mirror it:

${EMBED_LOADER_URL}

The loader internally calls the mother's chat proxy on the same host. That call is the loader's business — don't reimplement, don't fetch from it, don't wrap it.

2. The only code you write — one script tag

Paste before </body> in index.html (or root layout). Token comes from Boss — request one, never invent one:

<script
  src="${EMBED_LOADER_URL}"
  data-token="${token}"
  data-title="OG Bot"
  data-color="#f5c542"
  defer
></script>

- data-token — issued by Boss. Treat as a secret.
- data-title / data-color — cosmetic only. Voice, persona, swearing and dictionary are NOT configurable from this side.

Optional React wrapper (still nothing more than the same script tag injected once):

import { useEffect } from "react";
export function OgBotWidget({ token }: { token: string }) {
  useEffect(() => {
    if ((window as any).__ogBotLoaded) return;
    const s = document.createElement("script");
    s.src = "${EMBED_LOADER_URL}";
    s.async = true;
    s.setAttribute("data-token", token);
    document.body.appendChild(s);
  }, [token]);
  return null;
}

Keep the token out of committed source. Inject from a server secret.

3. Hard rules — what NOT to do

- ⛔ Do not implement any chat logic, system prompt, persona, swear lexicon, dictionary, voice settings, or foul-mouth toggle in this project.
- ⛔ Do not create a chat API, edge function, server route, AI gateway call or model call here. The loader handles everything — you call no AI yourself.
- ⛔ Do not store, log, fetch, mirror or cache any dictionary words, swear words, persona text, system prompts or model identifiers.
- ⛔ Do not connect this project to the mother database. Do not paste any mother keys (service role, anon, JWT) anywhere. Do not write SQL against the mother schema.
- ⛔ Do not add config UI for tone, language, voice or swearing — those toggles are Boss-only on the mother project.
- ✅ Your job is one script tag pointed at the loader URL, with a token Boss gave you. Nothing more.

4. Verify

Click 💬 and send: "introduce yourself with maximum bite".
- Sweary, sharp British reply → wired correctly, inheriting live OG Bot Code.
- Polite / sanitised reply, or "Forbidden / Invalid token" toast → token wrong or this site's domain not whitelisted by Boss. Request a new token or domain approval. Do not fix this by editing anything here beyond the script tag.`;
}


export const Route = createFileRoute("/_authenticated/admin/og-bot")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (error || !isAdmin) throw redirect({ to: "/" });
  },
  component: OgBotSettingsPage,
});

interface TokenRow {
  user_id: string;
  token: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}
interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
}

type ExpiryStatus = "expired" | "expiring" | "active" | "never";
const EXPIRING_WINDOW_MS = 7 * 86400_000;

function expiryStatus(expires_at: string | null, nowMs: number): ExpiryStatus {
  if (!expires_at) return "never";
  const t = new Date(expires_at).getTime();
  if (t < nowMs) return "expired";
  if (t - nowMs < EXPIRING_WINDOW_MS) return "expiring";
  return "active";
}

const STATUS_LABEL: Record<ExpiryStatus | "all", string> = {
  all: "All",
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  never: "No expiry",
};

const STATUS_BADGE: Record<ExpiryStatus, string> = {
  expired: "bg-destructive/15 text-destructive border-destructive/30",
  expiring: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  never: "bg-muted text-muted-foreground border-border",
};

type SortKey = "created_desc" | "expires_asc" | "expires_desc" | "last_used_desc";

function OgBotSettingsPage() {
  const { isAdmin, isLoading } = useRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<ExpiryStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_desc");
  const [expiryEditFor, setExpiryEditFor] = useState<TokenRow | null>(null);

  // Step-up auth state: tokens stay masked until the boss re-enters their
  // password. After success, reveal/copy is unlocked for REAUTH_TTL_MS.
  const [reauthedUntil, setReauthedUntil] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);
  const unlocked = reauthedUntil > now;
  const unlockedSecondsLeft = unlocked ? Math.max(0, Math.ceil((reauthedUntil - now) / 1000)) : 0;

  // Pending action waiting on re-auth: "reveal" or "copy" + which token.
  const [pending, setPending] = useState<{ kind: "reveal" | "copy"; userId: string } | null>(null);
  const [showReauth, setShowReauth] = useState(false);

  const tokensQ = useQuery({
    queryKey: ["admin-og-bot-tokens"],
    enabled: isAdmin,
    queryFn: async (): Promise<TokenRow[]> => {
      const { data, error } = await supabase
        .from("og_bot_tokens")
        .select("user_id, token, created_at, updated_at, last_used_at, expires_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TokenRow[];
    },
  });

  const userIds = (tokensQ.data ?? []).map((t) => t.user_id);

  const profilesQ = useQuery({
    queryKey: ["admin-og-bot-profiles", userIds.sort().join(",")],
    enabled: isAdmin && userIds.length > 0,
    queryFn: async (): Promise<Record<string, ProfileRow>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);
      if (error) throw error;
      const m: Record<string, ProfileRow> = {};
      ((data ?? []) as ProfileRow[]).forEach((p) => (m[p.id] = p));
      return m;
    },
  });

  const rotate = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("regenerate_og_bot_token", {
        target_user_id: userId,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: (newToken, userId) => {
      toast.success("Token rotated");
      // Only auto-reveal if the boss is currently re-authed; otherwise
      // keep the new token masked until the next successful re-auth.
      if (reauthedUntil > Date.now()) {
        setRevealed((r) => ({ ...r, [userId]: true }));
      }
      // Optimistic: keep cache up to date with new token
      qc.setQueryData<TokenRow[]>(["admin-og-bot-tokens"], (prev) =>
        (prev ?? []).map((t) =>
          t.user_id === userId
            ? { ...t, token: newToken, updated_at: new Date().toISOString(), last_used_at: null, expires_at: t.expires_at }
            : t,
        ),
      );
      qc.invalidateQueries({ queryKey: ["admin-user-audit", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("set_og_bot_admin", {
        target_user_id: userId,
        make_og: false,
        admin_notes: "boss_revoke_from_og_bot_panel",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("OG Bot access revoked");
      qc.invalidateQueries({ queryKey: ["admin-og-bot-tokens"] });
      qc.invalidateQueries({ queryKey: ["admin-user-roles"] });
      qc.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setExpiry = useMutation({
    mutationFn: async (vars: { userId: string; expiresAt: string | null }) => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "set_og_bot_token_expiry",
        {
          target_user_id: vars.userId,
          new_expires_at: vars.expiresAt,
          admin_notes: "boss_set_expiry_from_og_bot_panel",
        },
      );
      if (error) throw new Error(error.message);
      return (data as string | null) ?? null;
    },
    onSuccess: (newExpires, vars) => {
      toast.success(newExpires ? "Expiry updated" : "Expiry cleared");
      qc.setQueryData<TokenRow[]>(["admin-og-bot-tokens"], (prev) =>
        (prev ?? []).map((t) =>
          t.user_id === vars.userId
            ? { ...t, expires_at: newExpires, updated_at: new Date().toISOString() }
            : t,
        ),
      );
      setExpiryEditFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || tokensQ.isLoading) {
    return (
      <DashboardShell title="OG Bot Setting">
        <div className="grid h-64 place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  const tokens = tokensQ.data ?? [];
  const profiles = profilesQ.data ?? {};
  const term = search.trim().toLowerCase();
  const byTerm = term
    ? tokens.filter((t) => {
        const p = profiles[t.user_id];
        return (
          t.user_id.toLowerCase().includes(term) ||
          t.token.toLowerCase().includes(term) ||
          (p?.email ?? "").toLowerCase().includes(term) ||
          (p?.display_name ?? "").toLowerCase().includes(term)
        );
      })
    : tokens;
  const byStatus =
    statusFilter === "all"
      ? byTerm
      : byTerm.filter((t) => expiryStatus(t.expires_at, now) === statusFilter);
  const filtered = [...byStatus].sort((a, b) => {
    switch (sortKey) {
      case "expires_asc": {
        const av = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY;
        const bv = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY;
        return av - bv;
      }
      case "expires_desc": {
        const av = a.expires_at ? new Date(a.expires_at).getTime() : -1;
        const bv = b.expires_at ? new Date(b.expires_at).getTime() : -1;
        return bv - av;
      }
      case "last_used_desc": {
        const av = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
        const bv = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
        return bv - av;
      }
      case "created_desc":
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const statusCounts: Record<ExpiryStatus, number> = {
    active: 0, expiring: 0, expired: 0, never: 0,
  };
  for (const t of tokens) statusCounts[expiryStatus(t.expires_at, now)]++;

  return (
    <DashboardShell title="OG Bot Setting">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="truncate font-semibold">OG Bot Setting</h2>
            <p className="text-xs text-muted-foreground">
              Manage generated OG Bot tokens. Boss-only — tokens grant automated access on behalf of the user.
            </p>
          </div>
          <Link to="/admin/users">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Users
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Active tokens" value={String(tokens.length)} />
          <StatCard
            label="Recently rotated"
            value={String(
              tokens.filter((t) => Date.now() - new Date(t.updated_at).getTime() < 7 * 86400_000).length,
            )}
            hint="Last 7 days"
          />
          <StatCard
            label="Never used"
            value={String(tokens.filter((t) => !t.last_used_at).length)}
          />
        </section>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, user id, or token…"
            className="pl-9"
          />
        </div>

        {/* Lock / unlock banner */}
        <div className={
          "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm " +
          (unlocked
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300")
        }>
          <div className="flex items-center gap-2">
            {unlocked ? <KeyRound className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            <span>
              {unlocked
                ? `Tokens unlocked for ${Math.floor(unlockedSecondsLeft / 60)}m ${unlockedSecondsLeft % 60}s`
                : "Tokens are masked. Re-enter your boss password to reveal or copy."}
            </span>
          </div>
          {unlocked ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setReauthedUntil(0);
                setRevealed({});
                toast.success("Tokens re-locked");
              }}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" /> Lock now
            </Button>
          ) : (
            <Button size="sm" onClick={() => { setPending(null); setShowReauth(true); }}>
              <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Unlock
            </Button>
          )}
        </div>

        {/* Tokens list */}
        <section className="rounded-2xl border border-border bg-card shadow-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Generated OG Bot tokens</h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {tokens.length}
            </span>
          </header>

          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              {tokens.length === 0
                ? "No OG Bot tokens yet. Grant a user OG Bot access from their user settings."
                : "No tokens match your search."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((t) => {
                const p = profiles[t.user_id];
                const isOpen = unlocked && !!revealed[t.user_id];
                const masked = `${t.token.slice(0, 8)}••••••••••••${t.token.slice(-4)}`;
                const requireReauth = (kind: "reveal" | "copy") => {
                  if (unlocked) return false;
                  setPending({ kind, userId: t.user_id });
                  setShowReauth(true);
                  return true;
                };
                return (
                  <li key={t.user_id} className="space-y-3 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/admin/users/$userId"
                          params={{ userId: t.user_id }}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {p?.display_name ?? p?.email ?? t.user_id}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{p?.email ?? "—"}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground/80">
                          {t.user_id}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rotate.mutate(t.user_id)}
                          disabled={rotate.isPending && rotate.variables === t.user_id}
                          title="Generate a fresh token (invalidates the old one)"
                        >
                          {rotate.isPending && rotate.variables === t.user_id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Rotate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (window.confirm("Revoke OG Bot access for this user? Their token will be deleted.")) {
                              revoke.mutate(t.user_id);
                            }
                          }}
                          disabled={revoke.isPending && revoke.variables === t.user_id}
                        >
                          {revoke.isPending && revoke.variables === t.user_id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Revoke
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
                      <code className="flex-1 truncate font-mono text-xs">
                        {isOpen ? t.token : masked}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          if (isOpen) {
                            setRevealed((r) => ({ ...r, [t.user_id]: false }));
                            return;
                          }
                          if (requireReauth("reveal")) return;
                          setRevealed((r) => ({ ...r, [t.user_id]: true }));
                        }}
                        title={isOpen ? "Hide token" : unlocked ? "Reveal token" : "Re-auth required to reveal"}
                      >
                        {isOpen ? <EyeOff className="h-3.5 w-3.5" /> : unlocked ? <Eye className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={async () => {
                          if (requireReauth("copy")) return;
                          try {
                            await navigator.clipboard.writeText(t.token);
                            toast.success("Token copied");
                          } catch {
                            toast.error("Could not copy to clipboard");
                          }
                        }}
                        title={unlocked ? "Copy token" : "Re-auth required to copy"}
                      >
                        {unlocked ? <Copy className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={async () => {
                          if (requireReauth("copy")) return;
                          try {
                            await navigator.clipboard.writeText(buildEmbedPrompt(t.token));
                            toast.success("Embed prompt copied — paste into the other project");
                          } catch {
                            toast.error("Could not copy to clipboard");
                          }
                        }}
                        title={unlocked ? "Copy embed prompt (with this token baked in)" : "Re-auth required to copy embed prompt"}
                      >
                        {unlocked ? <Code2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      </Button>
                    </div>

                    <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-3">
                      <span>Created {new Date(t.created_at).toLocaleString()}</span>
                      <span>Updated {new Date(t.updated_at).toLocaleString()}</span>
                      <span>
                        Last used{" "}
                        {t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "—"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <ReauthDialog
        open={showReauth}
        email={user?.email ?? null}
        intent={pending?.kind ?? null}
        onCancel={() => { setShowReauth(false); setPending(null); }}
        onSuccess={async () => {
          setReauthedUntil(Date.now() + REAUTH_TTL_MS);
          setShowReauth(false);
          // Carry out the originally-requested action automatically.
          if (pending) {
            if (pending.kind === "reveal") {
              setRevealed((r) => ({ ...r, [pending.userId]: true }));
            } else if (pending.kind === "copy") {
              const t = (tokensQ.data ?? []).find((x) => x.user_id === pending.userId);
              if (t) {
                try {
                  await navigator.clipboard.writeText(t.token);
                  toast.success("Token copied");
                } catch {
                  toast.error("Could not copy to clipboard");
                }
              }
            }
            setPending(null);
          }
        }}
      />
    </DashboardShell>
  );
}

interface ReauthDialogProps {
  open: boolean;
  email: string | null;
  intent: "reveal" | "copy" | null;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
}

function ReauthDialog({ open, email, intent, onCancel, onSuccess }: ReauthDialogProps) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("No signed-in email found");
      return;
    }
    if (!password) {
      toast.error("Enter your boss password");
      return;
    }
    setSubmitting(true);
    try {
      // Re-auth pattern: verify the boss password without disrupting the
      // active session. signInWithPassword refreshes the same session.
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Incorrect password");
        return;
      }
      await onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-auth failed");
    } finally {
      setSubmitting(false);
    }
  }

  const intentText =
    intent === "reveal"
      ? "Confirm your password to reveal this OG Bot token."
      : intent === "copy"
      ? "Confirm your password to copy this OG Bot token to your clipboard."
      : "Confirm your password to unlock OG Bot tokens for the next 5 minutes.";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Boss re-auth required
          </DialogTitle>
          <DialogDescription>{intentText}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Signed in as</label>
            <Input value={email ?? ""} readOnly disabled className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reauth-password" className="text-xs font-medium text-muted-foreground">
              Boss password
            </label>
            <Input
              id="reauth-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !password || !email}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Unlock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
