import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot, Loader2, ShieldCheck, Copy, RotateCcw, Trash2, Search, ArrowLeft, Eye, EyeOff, Lock, KeyRound, Code2, CalendarClock, UserPlus, Plug, RefreshCw, Flame, Undo2,
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
import { pingOgBot } from "@/lib/og-bot-status.functions";
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
  component: OgBotSettingsPage,
});

interface TokenRow {
  user_id: string;
  token: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}
interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
}

type TokenStatus = "burned" | "expired" | "expiring" | "active" | "never";
const EXPIRING_WINDOW_MS = 7 * 86400_000;

function tokenStatus(row: Pick<TokenRow, "expires_at" | "revoked_at">, nowMs: number): TokenStatus {
  if (row.revoked_at) return "burned";
  if (!row.expires_at) return "never";
  const t = new Date(row.expires_at).getTime();
  if (t < nowMs) return "expired";
  if (t - nowMs < EXPIRING_WINDOW_MS) return "expiring";
  return "active";
}

const STATUS_LABEL: Record<TokenStatus | "all", string> = {
  all: "All",
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  never: "No expiry",
  burned: "Burned",
};

const STATUS_BADGE: Record<TokenStatus, string> = {
  expired: "bg-destructive/15 text-destructive border-destructive/30",
  expiring: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  never: "bg-muted text-muted-foreground border-border",
  burned: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

type SortKey = "created_desc" | "expires_asc" | "expires_desc" | "last_used_desc";

function OgBotSettingsPage() {
  const { isAdmin, isLoading } = useRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<TokenStatus | "all">("all");
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
        .select("user_id, token, created_at, updated_at, last_used_at, expires_at, revoked_at")
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

  const burn = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "revoke_og_bot_token",
        { target_user_id: userId, admin_notes: "boss_burn_from_og_bot_panel" },
      );
      if (error) throw new Error(error.message);
      return (data as string | null) ?? new Date().toISOString();
    },
    onSuccess: (ts, userId) => {
      toast.success("Token burned");
      qc.setQueryData<TokenRow[]>(["admin-og-bot-tokens"], (prev) =>
        (prev ?? []).map((t) =>
          t.user_id === userId ? { ...t, revoked_at: ts, updated_at: new Date().toISOString() } : t,
        ),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "unrevoke_og_bot_token",
        { target_user_id: userId, admin_notes: "boss_restore_from_og_bot_panel" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: (_v, userId) => {
      toast.success("Token restored");
      qc.setQueryData<TokenRow[]>(["admin-og-bot-tokens"], (prev) =>
        (prev ?? []).map((t) =>
          t.user_id === userId ? { ...t, revoked_at: null, updated_at: new Date().toISOString() } : t,
        ),
      );
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

  // Grant a fresh OG Bot token to any user (creates the og_bot role +
  // token row in one shot via set_og_bot_admin).
  const grant = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase.rpc("set_og_bot_admin", {
        target_user_id: targetUserId,
        make_og: true,
        admin_notes: "boss_grant_from_og_bot_panel",
      });
      if (error) throw new Error(error.message);
      return targetUserId;
    },
    onSuccess: () => {
      toast.success("OG Bot token issued");
      qc.invalidateQueries({ queryKey: ["admin-og-bot-tokens"] });
      qc.invalidateQueries({ queryKey: ["admin-og-bot-grantable"] });
      qc.invalidateQueries({ queryKey: ["admin-user-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Backend reachability ping. Refreshes every 60s.
  const pingFn = useServerFn(pingOgBot);
  const pingQ = useQuery({
    queryKey: ["og-bot-backend-ping"],
    enabled: isAdmin,
    queryFn: () => pingFn(),
    refetchInterval: 60_000,
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
      : byTerm.filter((t) => tokenStatus(t, now) === statusFilter);
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

  const statusCounts: Record<TokenStatus, number> = {
    active: 0, expiring: 0, expired: 0, never: 0, burned: 0,
  };
  for (const t of tokens) statusCounts[tokenStatus(t, now)]++;

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
              Manage OG Bot tokens. The token authenticates both the user's Messenger and the floating Boss widget.
            </p>
          </div>
          <BackendStatusPill
            data={pingQ.data}
            loading={pingQ.isFetching}
            onRefresh={() => pingQ.refetch()}
          />
          <Link to="/admin/users">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Users
            </Button>
          </Link>
        </div>

        {/* Grant a new token */}
        <GrantTokenPanel
          existingUserIds={tokens.map((t) => t.user_id)}
          onGrant={(id) => grant.mutate(id)}
          isPending={grant.isPending}
          pendingId={typeof grant.variables === "string" ? grant.variables : null}
        />

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Total tokens" value={String(tokens.length)} />
          <StatCard label="Active" value={String(statusCounts.active + statusCounts.never)} hint={`${statusCounts.never} no expiry`} />
          <StatCard label="Expiring soon" value={String(statusCounts.expiring)} hint="Next 7 days" />
          <StatCard label="Expired" value={String(statusCounts.expired)} />
        </section>


        {/* Search + filter + sort */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, name, user id, or token…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "active", "expiring", "expired", "never", "burned"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setStatusFilter(k)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition " +
                  (statusFilter === k
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground")
                }
              >
                {STATUS_LABEL[k]}
                {k !== "all" && (
                  <span className="ml-1.5 tabular-nums opacity-70">
                    {statusCounts[k as TokenStatus]}
                  </span>
                )}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>Sort</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs"
              >
                <option value="created_desc">Newest</option>
                <option value="expires_asc">Expiring soonest</option>
                <option value="expires_desc">Expiring latest</option>
                <option value="last_used_desc">Recently used</option>
              </select>
            </div>
          </div>
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
                const status: TokenStatus = tokenStatus(t, now);
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
                        <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[status]}`}>
                          {status === "burned" ? <Flame className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
                          {status === "burned"
                            ? `Burned ${t.revoked_at ? new Date(t.revoked_at).toLocaleDateString() : ""}`
                            : status === "never"
                            ? "No expiry"
                            : status === "expired"
                            ? `Expired ${new Date(t.expires_at!).toLocaleDateString()}`
                            : status === "expiring"
                            ? `Expires ${new Date(t.expires_at!).toLocaleDateString()}`
                            : `Active until ${new Date(t.expires_at!).toLocaleDateString()}`}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpiryEditFor(t)}
                          title="Set or clear this token's expiry date"
                        >
                          <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                          Expiry
                        </Button>
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

                    <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-4">
                      <span>Created {new Date(t.created_at).toLocaleString()}</span>
                      <span>Updated {new Date(t.updated_at).toLocaleString()}</span>
                      <span>
                        Last used{" "}
                        {t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "—"}
                      </span>
                      <span>
                        Expires{" "}
                        {t.expires_at ? new Date(t.expires_at).toLocaleString() : "never"}
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

      <ExpiryDialog
        token={expiryEditFor}
        profile={expiryEditFor ? profiles[expiryEditFor.user_id] ?? null : null}
        submitting={setExpiry.isPending}
        onCancel={() => setExpiryEditFor(null)}
        onSave={(expiresAt) => {
          if (!expiryEditFor) return;
          setExpiry.mutate({ userId: expiryEditFor.user_id, expiresAt });
        }}
      />
    </DashboardShell>
  );
}

interface ExpiryDialogProps {
  token: TokenRow | null;
  profile: ProfileRow | null;
  submitting: boolean;
  onCancel: () => void;
  onSave: (expiresAt: string | null) => void;
}

function ExpiryDialog({ token, profile, submitting, onCancel, onSave }: ExpiryDialogProps) {
  const [mode, setMode] = useState<"never" | "datetime" | "preset">("never");
  const [datetime, setDatetime] = useState<string>("");
  const [preset, setPreset] = useState<"1d" | "7d" | "30d" | "90d" | "365d">("30d");

  useEffect(() => {
    if (!token) return;
    if (token.expires_at) {
      setMode("datetime");
      // datetime-local input expects "YYYY-MM-DDTHH:mm" in local time
      const d = new Date(token.expires_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      setDatetime(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
    } else {
      setMode("never");
      setDatetime("");
    }
    setPreset("30d");
  }, [token?.user_id, token?.expires_at]);

  if (!token) return null;

  const presetMs: Record<typeof preset, number> = {
    "1d": 86400_000,
    "7d": 7 * 86400_000,
    "30d": 30 * 86400_000,
    "90d": 90 * 86400_000,
    "365d": 365 * 86400_000,
  };

  function submit() {
    if (mode === "never") {
      onSave(null);
      return;
    }
    if (mode === "preset") {
      onSave(new Date(Date.now() + presetMs[preset]).toISOString());
      return;
    }
    if (!datetime) {
      toast.error("Pick a date and time");
      return;
    }
    const iso = new Date(datetime).toISOString();
    onSave(iso);
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" /> Set token expiry
          </DialogTitle>
          <DialogDescription>
            {profile?.display_name ?? profile?.email ?? token.user_id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={mode === "never"} onChange={() => setMode("never")} />
              <span>No expiry (token never expires)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={mode === "preset"} onChange={() => setMode("preset")} />
              <span>Expire in…</span>
              <select
                disabled={mode !== "preset"}
                value={preset}
                onChange={(e) => setPreset(e.target.value as typeof preset)}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs disabled:opacity-50"
              >
                <option value="1d">1 day</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="365d">1 year</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={mode === "datetime"} onChange={() => setMode("datetime")} />
              <span>Expire on a specific date</span>
            </label>
            {mode === "datetime" && (
              <Input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="ml-6 w-[calc(100%-1.5rem)]"
              />
            )}
          </div>

          {token.expires_at && (
            <p className="text-xs text-muted-foreground">
              Current expiry: {new Date(token.expires_at).toLocaleString()}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save expiry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

interface BackendStatusPillProps {
  data: { ok: boolean; status: number; latencyMs?: number; host: string | null; error?: string } | undefined;
  loading: boolean;
  onRefresh: () => void;
}

function BackendStatusPill({ data, loading, onRefresh }: BackendStatusPillProps) {
  const ok = !!data?.ok;
  const cls = loading
    ? "border-border bg-muted text-muted-foreground"
    : ok
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-destructive/30 bg-destructive/10 text-destructive";
  const label = loading
    ? "Checking…"
    : ok
    ? `Bot online · ${data?.latencyMs ?? 0}ms`
    : data
    ? `Offline · ${data.status || data.error || "no response"}`
    : "Unknown";
  return (
    <button
      type="button"
      onClick={onRefresh}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${cls}`}
      title={data?.host ?? "OG Bot backend"}
    >
      <Plug className="h-3 w-3" />
      {label}
      <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : "opacity-60"}`} />
    </button>
  );
}

interface GrantTokenPanelProps {
  existingUserIds: string[];
  onGrant: (userId: string) => void;
  isPending: boolean;
  pendingId: string | null;
}

interface GrantableProfile {
  id: string;
  email: string | null;
  display_name: string | null;
}

function GrantTokenPanel({ existingUserIds, onGrant, isPending, pendingId }: GrantTokenPanelProps) {
  const [query, setQuery] = useState("");
  const term = query.trim();

  const candidatesQ = useQuery({
    queryKey: ["admin-og-bot-grantable", term, existingUserIds.length],
    queryFn: async (): Promise<GrantableProfile[]> => {
      let q = supabase
        .from("profiles")
        .select("id, email, display_name")
        .order("created_at", { ascending: false })
        .limit(8);
      if (term) {
        const safe = term.replace(/[%,]/g, " ");
        q = q.or(`email.ilike.%${safe}%,display_name.ilike.%${safe}%,id.ilike.%${safe}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      const have = new Set(existingUserIds);
      return ((data ?? []) as GrantableProfile[]).filter((p) => !have.has(p.id));
    },
  });

  const rows = candidatesQ.data ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
      <header className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Issue OG Bot token to a user</h3>
      </header>
      <p className="text-xs text-muted-foreground">
        Search any user, then click Issue token. The backend mints an <code className="font-mono">ogb_…</code> token that
        unlocks both the Bot Messenger and the Boss widget for that user.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email, display name, or user id…"
          className="pl-9"
        />
      </div>
      {candidatesQ.isLoading ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          {term ? "No matching users without a token." : "No more users left to grant."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {p.display_name ?? p.email ?? p.id}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{p.email ?? "—"}</p>
              </div>
              <Button
                size="sm"
                onClick={() => onGrant(p.id)}
                disabled={isPending && pendingId === p.id}
              >
                {isPending && pendingId === p.id ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                )}
                Issue token
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
