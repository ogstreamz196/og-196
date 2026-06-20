import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Code2, Coins, Copy, Check, Eye, EyeOff, Globe, Loader2, Plus, Power, PowerOff,
  ShieldCheck, Sparkles, Music2, Bot, Users as UsersIcon, Settings as SettingsIcon,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/developer")({
  component: DeveloperCenter,
});

const TOKEN_COST = 25;
const WIDGET_CDN = "https://cdn.ogstreamz.co.uk/widget.js";

interface BotToken {
  id: string;
  token_string: string;
  status: string;
  allowed_domain: string | null;
  created_at: string;
}

function mask(token: string) {
  if (token.length < 12) return token;
  return `${token.slice(0, 8)}${"•".repeat(10)}${token.slice(-4)}`;
}

function DeveloperCenter() {
  const { isAdmin } = useRole();

  return (
    <DashboardShell title="Developer Center">
      <div className="mx-auto max-w-6xl">
        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings" className="gap-2">
              <SettingsIcon className="h-4 w-4" /> Settings
            </TabsTrigger>
            <TabsTrigger value="tokens" className="gap-2">
              <Code2 className="h-4 w-4" /> OG Bot Tokens
            </TabsTrigger>
            <TabsTrigger value="users" disabled={!isAdmin} className="gap-2">
              <UsersIcon className="h-4 w-4" /> Manage Users
              {!isAdmin && <span className="text-[10px] text-muted-foreground">(dev only)</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <SettingsTab />
          </TabsContent>

          <TabsContent value="tokens" className="space-y-6">
            <TokensTab />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            {isAdmin ? <ManageUsersTab /> : <DevOnlyNotice />}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

/* ---------- Settings tab: toggle format ---------- */

interface ToggleDef {
  key: string;
  label: string;
  desc: string;
}

const MUSIC_HUB_TOGGLES: ToggleDef[] = [
  { key: "mh_autoplay", label: "Autoplay new tracks", desc: "Start playing songs as soon as they finish generating." },
  { key: "mh_show_lyrics", label: "Show lyrics by default", desc: "Open the lyrics panel automatically on every song." },
  { key: "mh_allow_downloads", label: "Allow downloads", desc: "Show the download button on completed tracks." },
  { key: "mh_public_library", label: "Public library", desc: "Make your finished tracks discoverable in the public hub." },
  { key: "mh_explicit_filter", label: "Filter explicit prompts", desc: "Block prompts containing flagged language before generation." },
];

const OG_BOT_TOGGLES: ToggleDef[] = [
  { key: "ob_widget_enabled", label: "Floating widget", desc: "Show the OG Bot bubble on every page." },
  { key: "ob_messenger_enabled", label: "OG Messenger", desc: "Enable the full-page chat experience." },
  { key: "ob_proactive_greetings", label: "Proactive greetings", desc: "Let OG Bot start the conversation when a visitor lands." },
  { key: "ob_voice_replies", label: "Voice replies", desc: "Read replies aloud using OG Bot's voice." },
  { key: "ob_foul_mouth", label: "Foul-mouth mode", desc: "Allow OG Bot to use unfiltered slang and adult language." },
];

function SettingsTab() {
  return (
    <>
      <SettingsGroup
        icon={<Music2 className="h-5 w-5 text-primary" />}
        title="Music Hub"
        subtitle="Control how Music Hub generates and displays your tracks."
        toggles={MUSIC_HUB_TOGGLES}
        storageKey="dev.music_hub"
      />
      <SettingsGroup
        icon={<Bot className="h-5 w-5 text-primary" />}
        title="OG Bot"
        subtitle="Tune the embedded OG Bot assistant for your account."
        toggles={OG_BOT_TOGGLES}
        storageKey="dev.og_bot"
      />
    </>
  );
}

function SettingsGroup({
  icon, title, subtitle, toggles, storageKey,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  toggles: ToggleDef[];
  storageKey: string;
}) {
  const [state, setState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setState(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [storageKey]);

  function update(k: string, v: boolean, label: string) {
    setState((prev) => {
      const next = { ...prev, [k]: v };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    toast.success(`${label} ${v ? "enabled" : "disabled"}`);
  }

  return (
    <div className="rounded-3xl border border-border bg-card/60 p-6 shadow-card backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15">{icon}</div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {toggles.map((t) => (
          <div key={t.key} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="font-medium">{t.label}</p>
              <p className="text-sm text-muted-foreground">{t.desc}</p>
            </div>
            <Switch
              checked={!!state[t.key]}
              onCheckedChange={(v) => update(t.key, v, t.label)}
              aria-label={t.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Manage Users tab (admin only) ---------- */

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  coin_balance: number;
  created_at: string;
}

interface RoleRow {
  user_id: string;
  role: string;
}

function ManageUsersTab() {
  const [q, setQ] = useState("");

  const usersQ = useQuery({
    queryKey: ["dev-users-list"],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, coin_balance, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["dev-users-roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const needle = q.trim().toLowerCase();
  const list = (usersQ.data ?? []).filter((u) =>
    !needle
    || (u.email ?? "").toLowerCase().includes(needle)
    || (u.display_name ?? "").toLowerCase().includes(needle)
    || u.id.toLowerCase().includes(needle),
  );

  const rolesByUser = new Map<string, string[]>();
  (rolesQ.data ?? []).forEach((r) => {
    const a = rolesByUser.get(r.user_id) ?? [];
    a.push(r.role);
    rolesByUser.set(r.user_id, a);
  });

  return (
    <div className="rounded-3xl border border-border bg-card/60 p-6 shadow-card backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Manage users</h3>
          <p className="text-sm text-muted-foreground">
            View signed-in and newly created users. Grant credits, toggle VIP, edit labels,
            or open a full per-user settings page.
          </p>
        </div>
        <Link to="/admin/users">
          <Button size="sm" variant="outline" className="gap-1.5">
            Open full admin <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search email, display name, or id…"
        className="mb-4 bg-background/60"
      />

      {usersQ.isLoading ? (
        <div className="grid place-items-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="grid place-items-center py-12 text-muted-foreground">No users match.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Roles</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const roles = rolesByUser.get(u.id) ?? ["user"];
                return (
                  <tr key={u.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="max-w-[260px] px-4 py-3">
                      <div className="truncate font-medium">{u.display_name ?? u.email ?? "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email ?? u.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {roles.map((r) => (
                          <span
                            key={r}
                            className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{u.coin_balance ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to="/admin/users/$userId" params={{ userId: u.id }}>
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <SettingsIcon className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DevOnlyNotice() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
      Manage Users is only available to project developers.
    </div>
  );
}

/* ---------- Tokens tab (existing marketplace) ---------- */

function TokensTab() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const balance = profile?.coin_balance ?? 0;

  const tokensQ = useQuery({
    queryKey: ["bot-tokens", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BotToken[]> => {
      const { data, error } = await supabase
        .from("bot_tokens")
        .select("id, token_string, status, allowed_domain, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BotToken[];
    },
  });

  const purchase = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("purchase_bot_token", {});
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("New OG Bot token minted!");
      qc.invalidateQueries({ queryKey: ["bot-tokens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => {
      const msg = e.message.includes("insufficient_coins")
        ? `You need ${TOKEN_COST} coins to purchase a token.`
        : e.message;
      toast.error(msg);
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`bot-tokens-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_tokens", filter: `developer_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["bot-tokens"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-8 shadow-card backdrop-blur-xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3 w-3 text-primary" />
          B2B Developer Marketplace
        </div>
        <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
          Run the <span className="text-gradient-brand">OG Bot</span> on your own codebase
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Purchase license tokens, bind them to your domain, and embed the floating widget on your sites.
          Each token costs <span className="font-semibold text-foreground">{TOKEN_COST} OG coins</span>.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="gap-2"
            onClick={() => purchase.mutate()}
            disabled={purchase.isPending || balance < TOKEN_COST}
          >
            {purchase.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Purchase New OG Bot Token
          </Button>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1.5 text-sm">
            <Coins className="h-4 w-4 text-coin" />
            <span className="tabular-nums">{balance}</span>
            <span className="text-muted-foreground">balance</span>
          </div>
          {balance < TOKEN_COST && (
            <span className="text-xs text-muted-foreground">
              Need {TOKEN_COST - balance} more coins — top up to purchase.
            </span>
          )}
        </div>
      </div>

      <section>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Code2 className="h-5 w-5 text-primary" />
          Your Active Tokens
        </h3>

        {tokensQ.isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !tokensQ.data || tokensQ.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground backdrop-blur">
            No tokens yet. Purchase your first OG Bot token above to get started.
          </div>
        ) : (
          <div className="grid gap-4">
            {tokensQ.data.map((t) => <TokenCard key={t.id} token={t} />)}
          </div>
        )}
      </section>
    </>
  );
}

function TokenCard({ token }: { token: BotToken }) {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [domain, setDomain] = useState(token.allowed_domain ?? "");
  const [saving, setSaving] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isSuspended = token.status !== "active";

  const snippet = `<script src="${WIDGET_CDN}" data-og-token="${token.token_string}"></script>`;

  async function confirmToggleSuspend() {
    setSuspending(true);
    const nextStatus = isSuspended ? "active" : "suspended";
    const { error } = await supabase
      .from("bot_tokens")
      .update({ status: nextStatus })
      .eq("id", token.id);
    setSuspending(false);
    setConfirmOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success(
      nextStatus === "suspended"
        ? "Token suspended — widget & OG Messenger hiding now"
        : "Token reactivated — service resumed",
    );
    qc.invalidateQueries({ queryKey: ["bot-tokens"] });
  }

  async function saveDomain() {
    const trimmed = domain.trim();
    if (trimmed && !/^https?:\/\/.+/i.test(trimmed)) {
      toast.error("Domain must start with http:// or https://");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("bot_tokens")
      .update({ allowed_domain: trimmed || null })
      .eq("id", token.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Domain binding updated");
    qc.invalidateQueries({ queryKey: ["bot-tokens"] });
  }

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-card backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <code className="rounded-md bg-background/60 px-2 py-1 font-mono text-xs">
                {revealed ? token.token_string : mask(token.token_string)}
              </code>
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
                aria-label={revealed ? "Hide token" : "Reveal token"}
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Created {new Date(token.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium " +
              (token.status === "active"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : "border-amber-500/40 bg-amber-500/10 text-amber-500")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {token.status}
          </span>
          <Button
            size="sm"
            variant={isSuspended ? "default" : "outline"}
            onClick={() => setConfirmOpen(true)}
            disabled={suspending}
            className="gap-1.5"
          >
            {suspending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isSuspended ? (
              <Power className="h-3.5 w-3.5" />
            ) : (
              <PowerOff className="h-3.5 w-3.5" />
            )}
            {isSuspended ? "Reactivate" : "Suspend"}
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Allowed domain
        </label>
        <div className="flex gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="https://myawesomecodebase.com"
            className="bg-background/60"
          />
          <Button onClick={saveDomain} disabled={saving} variant="secondary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Integration snippet</span>
          <button
            type="button"
            onClick={copySnippet}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs font-medium transition hover:border-primary/40 hover:text-primary"
          >
            {copied ? (
              <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!</>
            ) : (
              <><Copy className="h-3.5 w-3.5" /> Copy Snippet</>
            )}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-border bg-background/70 p-3 text-xs">
          <code className="font-mono text-foreground/90">{snippet}</code>
        </pre>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isSuspended ? "Reactivate this token?" : "Suspend this token?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuspended
                ? "This will resume access for the OG Bot widget on every site using this token."
                : "This will immediately deny access and hide the OG Bot widget on every site using this token."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={suspending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmToggleSuspend(); }}
              disabled={suspending}
              className={isSuspended ? "bg-emerald-500 hover:bg-emerald-600" : "bg-destructive hover:bg-destructive/90"}
            >
              {suspending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSuspended ? "Yes, reactivate" : "Yes, suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
