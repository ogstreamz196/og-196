import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, RefreshCw, Lock, Unlock, Music2, Save, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { maskDevIdentity } from "@/lib/dev-identity";
import { useRole } from "@/hooks/use-role";
import { useSettings } from "@/hooks/use-settings";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PortalManager } from "@/components/admin/PortalManager";
import { MintCoinsPanel } from "@/components/admin/MintCoinsPanel";
import { OgCoinsPanel } from "@/components/admin/OgCoinsPanel";
import { BossAuditLog } from "@/components/admin/BossAuditLog";
import { BossNav } from "@/components/admin/BossNav";

import { HardwiredCapabilities } from "@/components/admin/HardwiredCapabilities";
import { AppToggles } from "@/components/admin/AppToggles";
import { OgBotPing } from "@/components/admin/OgBotPing";
import { TelegramWebhookStatus } from "@/components/admin/TelegramWebhookStatus";
import { BossNotificationsPanel } from "@/components/admin/BossNotificationsPanel";
import { TelegramSmokeTest } from "@/components/admin/TelegramSmokeTest";
import { E2ESmokeTest } from "@/components/admin/E2ESmokeTest";

import { AdminSection } from "@/components/admin/AdminSection";
import { AdminCollapsible } from "@/components/admin/AdminCollapsible";
import { AdminEditableLabel, AdminEditableBalance } from "@/components/admin/AdminEditMode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminPanel,
});

interface AdminSong {
  id: string;
  user_id: string;
  title: string | null;
  prompt: string;
  status: string;
  unlocked: boolean;
  error_message: string | null;
  created_at: string;
}

function AdminPanel() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const qc = useQueryClient();

  const songsQuery = useQuery({
    queryKey: ["admin-songs"],
    enabled: isAdmin,
    queryFn: async (): Promise<(AdminSong & { email: string | null; display_name: string | null; coin_balance: number })[]> => {
      const { data: songs, error } = await supabase
        .from("songs")
        .select("id, user_id, title, prompt, status, unlocked, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const list = (songs ?? []) as AdminSong[];
      const userIds = Array.from(new Set(list.map((s) => s.user_id)));
      let map = new Map<string, { email: string | null; display_name: string | null; coin_balance: number }>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id, email, display_name, coin_balance").in("id", userIds);
        map = new Map((profs ?? []).map((p: any) => {
          const m = maskDevIdentity({ email: p.email, display_name: p.display_name });
          return [p.id, { email: m.email, display_name: m.display_name, coin_balance: p.coin_balance }];
        }));
      }
      return list.map((s) => ({
        ...s,
        email: map.get(s.user_id)?.email ?? null,
        display_name: map.get(s.user_id)?.display_name ?? null,
        coin_balance: map.get(s.user_id)?.coin_balance ?? 0,
      }));
    },
  });

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-songs-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "songs" },
        () => songsQuery.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const toggleUnlock = useMutation({
    mutationFn: async ({ id, unlocked }: { id: string; unlocked: boolean }) => {
      const { error } = await supabase.from("songs").update({ unlocked }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-songs"] });
      toast.success("Song updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reprocess = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-reprocess", {
        body: { song_id: id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-songs"] });
      toast.success("Reprocessing started");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (roleLoading) {
    return (
      <DashboardShell title="Admin Controls">
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <DashboardShell title="Admin Controls">
      <BossNav />
      <div className="mx-auto max-w-6xl">
        <AdminSection
          padding="p-4"
          icon={<ShieldCheck className="h-5 w-5 text-primary-foreground" />}
          title="Admin controls"
          subtitle="Pricing, portals, app toggles, recent generations, manual unlocks, and retries."
          action={
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/users">
                <Button size="sm" variant="outline">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Manage users
                </Button>
              </Link>
              <Link to="/admin/og-persona">
                <Button size="sm" variant="outline">OG Bot Persona</Button>
              </Link>
              <Link to="/admin/user-settings">
                <Button size="sm" variant="outline">User Settings</Button>
              </Link>
              <Link to="/admin/api-keys">
                <Button size="sm" variant="outline">API Keys</Button>
              </Link>
              <Link to="/admin/debug-context">
                <Button size="sm" variant="outline">Lyric Context Debug</Button>
              </Link>
            </div>
          }
        >
          {null}
        </AdminSection>


        <AdminCollapsible storageKey="og-coins" title="OG Coins" subtitle="Boss coin operations" defaultOpen>
          <OgCoinsPanel />
        </AdminCollapsible>

        <AdminCollapsible storageKey="pricing" title="Pricing & limits" subtitle="Generation, unlock and signup costs">
          <PricingControls />
        </AdminCollapsible>

        <AdminCollapsible storageKey="app-toggles" title="App toggles" subtitle="Global feature flags">
          <AppToggles />
        </AdminCollapsible>

        <AdminCollapsible storageKey="mint-coins" title="Mint coins" subtitle="Grant or deduct user balance">
          <MintCoinsPanel />
        </AdminCollapsible>

        <AdminCollapsible storageKey="portals" title="Portals" subtitle="Manage portal definitions">
          <PortalManager />
        </AdminCollapsible>

        <AdminCollapsible storageKey="boss-audit" title="Boss audit log" subtitle="Recent admin actions">
          <BossAuditLog />
        </AdminCollapsible>

        <AdminCollapsible storageKey="og-bot-ping" title="OG Bot ping" subtitle="Verify OG Bot connectivity">
          <OgBotPing />
        </AdminCollapsible>

        <AdminCollapsible storageKey="telegram-webhook" title="Telegram webhook" subtitle="Live delivery status">
          <TelegramWebhookStatus />
        </AdminCollapsible>

        <AdminCollapsible storageKey="telegram-smoke" title="Telegram smoke test" subtitle="getMe + webhook check">
          <TelegramSmokeTest />
        </AdminCollapsible>

        <AdminCollapsible storageKey="e2e-smoke" title="End-to-end smoke test" subtitle="Full stack flow">
          <E2ESmokeTest />
        </AdminCollapsible>

        <AdminCollapsible storageKey="boss-notifs" title="Boss notifications" subtitle="DM preferences">
          <BossNotificationsPanel />
        </AdminCollapsible>

        <AdminCollapsible storageKey="capabilities" title="Hardwired capabilities" subtitle="Connector & runtime status">
          <HardwiredCapabilities />
        </AdminCollapsible>

        <AdminCollapsible storageKey="recent-songs" title="Recent generations" subtitle="Unlock, lock, retry" defaultOpen>
        <div className="rounded-2xl border border-border bg-card shadow-card">

          {songsQuery.isLoading ? (
            <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : songsQuery.data && songsQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Song</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Unlocked</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {songsQuery.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-[260px]">
                      <div className="truncate font-medium">{s.title || "Untitled"}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.prompt}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="text-muted-foreground">{s.email ?? s.user_id.slice(0, 8)}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs">
                        <AdminEditableLabel userId={s.user_id} value={s.display_name} fallback="No label" />
                        <AdminEditableBalance userId={s.user_id} value={s.coin_balance} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        s.status === "completed" && "bg-primary/15 text-primary",
                        (s.status === "pending" || s.status === "processing") && "bg-muted text-muted-foreground",
                        s.status === "failed" && "bg-destructive/15 text-destructive",
                      )}>
                        {s.status}
                      </span>
                      {s.status === "failed" && s.error_message && (
                        <div className="mt-1 max-w-[200px] truncate text-xs text-destructive/80">{s.error_message}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                        s.unlocked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        {s.unlocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {s.unlocked ? "Unlocked" : "Locked"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant={s.unlocked ? "outline" : "default"}
                          disabled={toggleUnlock.isPending}
                          onClick={() => toggleUnlock.mutate({ id: s.id, unlocked: !s.unlocked })}
                        >
                          {s.unlocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                          <span className="ml-1.5">{s.unlocked ? "Lock" : "Unlock"}</span>
                        </Button>
                        {s.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reprocess.isPending}
                            onClick={() => reprocess.mutate(s.id)}
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", reprocess.isPending && "animate-spin")} />
                            <span className="ml-1.5">Retry</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </div>
            </div>
          ) : (
            <div className="grid place-items-center gap-2 py-16 text-muted-foreground">
              <Music2 className="h-8 w-8" />
              <p>No songs yet.</p>
            </div>
          )}
        </div>
        </AdminCollapsible>
      </div>
    </DashboardShell>

  );
}


type FieldRule = { min: number; max: number; integer?: boolean; label: string; help?: string };
const PRICING_RULES: Record<string, FieldRule> = {
  signup_credits: { min: 0, max: 1000, integer: true, label: "Free-tier signup OG Coins", help: "Granted once on first sign-in." },
  coins_per_generation: { min: 0, max: 10000, integer: true, label: "Coins per song generation", help: "Charged when a user generates new audio tracks." },
  coins_per_lyrics_generation: { min: 0, max: 10000, integer: true, label: "Coins per lyrics generation", help: "Charged each time AI lyrics are generated or regenerated." },
  songs_per_generation: { min: 1, max: 4, integer: true, label: "Songs per generation", help: "How many audio variations are produced per request." },
  coins_per_variation_divisor: { min: 1, max: 20, integer: true, label: "Variation cost divisor", help: "Reveal cost per extra variation = generation cost ÷ this number." },
  sample_seconds: { min: 5, max: 600, integer: true, label: "Sample length (seconds)", help: "Max preview duration the player will stream." },
  coins_per_full_unlock: { min: 0, max: 100000, integer: true, label: "Coins to unlock full song", help: "Charged when a user downloads the HQ full version." },
};

function validatePricing(key: string, raw: string): string | null {
  const rule = PRICING_RULES[key];
  if (!rule) return null;
  if (raw.trim() === "") return "Required";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Must be a number";
  if (rule.integer && !Number.isInteger(n)) return "Must be a whole number";
  if (n < rule.min) return `Must be ≥ ${rule.min}`;
  if (n > rule.max) return `Must be ≤ ${rule.max}`;
  return null;
}

function PricingControls() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      setValues(
        Object.fromEntries(
          Object.keys(PRICING_RULES).map((k) => [k, String((settings as any)[k])]),
        ),
      );
    }
  }, [settings]);

  const errors: Record<string, string | null> = Object.fromEntries(
    Object.keys(PRICING_RULES).map((k) => [k, validatePricing(k, values[k] ?? "")]),
  );
  const hasErrors = Object.values(errors).some((e) => e !== null);
  const dirty = !!settings && Object.keys(PRICING_RULES).some(
    (k) => String((settings as any)[k]) !== (values[k] ?? ""),
  );

  const save = useMutation({
    mutationFn: async () => {
      if (hasErrors) throw new Error("Fix validation errors first");
      const updates = Object.keys(PRICING_RULES).map((k) => ({ key: k, value: Number(values[k]) }));
      for (const u of updates) {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: u.key, value: u.value as any }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Pricing updated — applies to new generations immediately");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renderField = (key: string) => {
    const rule = PRICING_RULES[key];
    const err = errors[key];
    return (
      <div key={key}>
        <Label htmlFor={key}>{rule.label}</Label>
        <Input
          id={key}
          type="number"
          min={rule.min}
          max={rule.max}
          step={rule.integer ? 1 : "any"}
          value={values[key] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          className={cn("mt-2", err && "border-destructive focus-visible:ring-destructive")}
          aria-invalid={!!err}
        />
        {err
          ? <p className="mt-1 text-xs text-destructive">{err}</p>
          : rule.help ? <p className="mt-1 text-xs text-muted-foreground">{rule.help}</p> : null}
      </div>
    );
  };

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Coins className="h-4 w-4 text-coin" />
        <h3 className="font-semibold">Pricing & limits</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.keys(PRICING_RULES).map(renderField)}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Changes take effect for the next generation. In-flight jobs keep the pricing captured at request time.
      </p>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending || hasErrors || !dirty}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save pricing
        </Button>
      </div>
    </div>
  );
}
