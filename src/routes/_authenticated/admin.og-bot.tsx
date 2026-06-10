import { createFileRoute, Navigate, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot, Loader2, ShieldCheck, Copy, RotateCcw, Trash2, Search, ArrowLeft, Eye, EyeOff, Lock, KeyRound,
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
}
interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
}

function OgBotSettingsPage() {
  const { isAdmin, isLoading } = useRole();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const tokensQ = useQuery({
    queryKey: ["admin-og-bot-tokens"],
    enabled: isAdmin,
    queryFn: async (): Promise<TokenRow[]> => {
      const { data, error } = await supabase
        .from("og_bot_tokens")
        .select("user_id, token, created_at, updated_at, last_used_at")
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
      setRevealed((r) => ({ ...r, [userId]: true }));
      // Optimistic: keep cache up to date with new token
      qc.setQueryData<TokenRow[]>(["admin-og-bot-tokens"], (prev) =>
        (prev ?? []).map((t) =>
          t.user_id === userId
            ? { ...t, token: newToken, updated_at: new Date().toISOString(), last_used_at: null }
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
  const filtered = term
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
                const isOpen = !!revealed[t.user_id];
                const masked = `${t.token.slice(0, 8)}••••••••••••${t.token.slice(-4)}`;
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
                        onClick={() => setRevealed((r) => ({ ...r, [t.user_id]: !isOpen }))}
                        title={isOpen ? "Hide token" : "Reveal token"}
                      >
                        {isOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(t.token);
                            toast.success("Token copied");
                          } catch {
                            toast.error("Could not copy to clipboard");
                          }
                        }}
                        title="Copy token"
                      >
                        <Copy className="h-3.5 w-3.5" />
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
    </DashboardShell>
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
