import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Coins, Check, Loader2,
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

export const Route = createFileRoute("/_authenticated/developer")({
  component: DeveloperCenter,
});


function DeveloperCenter() {
  const { isAdmin } = useRole();

  return (
    <DashboardShell title="Developer Center">
      <div className="mx-auto max-w-6xl">
        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings" className="gap-2">
              <SettingsIcon className="h-4 w-4" /> Settings
            </TabsTrigger>
            <TabsTrigger value="users" disabled={!isAdmin} className="gap-2">
              <UsersIcon className="h-4 w-4" /> Manage Users
              {!isAdmin && <span className="text-[10px] text-muted-foreground">(dev only)</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <SettingsTab />
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
            View signed-in and newly created users. Grant OG Coins, toggle VIP, edit labels,
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

