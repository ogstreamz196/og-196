import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Activity, Bot, Coins, Loader2, Music2, Save, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { FoulMouthSmokeTest } from "@/components/admin/FoulMouthSmokeTest";
import { AdminCollapsible } from "@/components/admin/AdminCollapsible";
import { BossKpiStrip, ProviderPulse } from "@/components/admin/BossOverview";
import { MusicDesk } from "@/components/admin/MusicDesk";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminPanel,
});

const TABS = [
  { value: "music", label: "Music desk", Icon: Music2 },
  { value: "economy", label: "Coins & pricing", Icon: Coins },
  { value: "bot", label: "Bot & Telegram", Icon: Bot },
  { value: "system", label: "App & diagnostics", Icon: Settings2 },
  { value: "activity", label: "Audit log", Icon: Activity },
] as const;

function AdminPanel() {
  const { isAdmin, isLoading: roleLoading } = useRole();

  if (roleLoading) {
    return (
      <DashboardShell title="Admin Controls">
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <DashboardShell title="Admin Controls">
      <BossNav />
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <h1 className="font-display text-2xl font-black">Boss Control Center</h1>
          <p className="text-sm text-muted-foreground">Live pulse, music, coins, bot and system.</p>
        </header>

        <BossKpiStrip />
        <ProviderPulse />

        <Tabs defaultValue="music" className="w-full">
          <TabsList className="mb-5 flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-border bg-card/70 p-1">
            {TABS.map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold sm:text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              >
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="music" className="mt-0">
            <MusicDesk />
          </TabsContent>

          <TabsContent value="economy" className="mt-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <OgCoinsPanel />
              <MintCoinsPanel />
            </div>
            <PricingControls />
          </TabsContent>

          <TabsContent value="bot" className="mt-0 space-y-3">
            <Panel k="og-bot-ping" title="OG Bot ping" subtitle="Verify OG Bot connectivity" open>
              <OgBotPing />
            </Panel>
            <Panel k="telegram-webhook" title="Telegram webhook" subtitle="Live delivery status" open>
              <TelegramWebhookStatus />
            </Panel>
            <Panel k="telegram-smoke" title="Telegram smoke test" subtitle="getMe + webhook check">
              <TelegramSmokeTest />
            </Panel>
            <Panel k="boss-notifs" title="Boss DM notifications" subtitle="Telegram DM preferences">
              <BossNotificationsPanel />
            </Panel>
          </TabsContent>

          <TabsContent value="system" className="mt-0 space-y-3">
            <Panel k="app-toggles" title="App toggles" subtitle="Global feature flags" open>
              <AppToggles />
            </Panel>
            <Panel k="portals" title="Portals" subtitle="Manage portal definitions">
              <PortalManager />
            </Panel>
            <Panel k="e2e-smoke" title="End-to-end smoke test" subtitle="Full stack flow">
              <E2ESmokeTest />
            </Panel>
            <Panel k="foul-smoke" title="Foul-mouth smoke test" subtitle="VIP gating + reply quality">
              <FoulMouthSmokeTest />
            </Panel>
            <Panel k="capabilities" title="Hardwired capabilities" subtitle="Runtime status">
              <HardwiredCapabilities />
            </Panel>
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <BossAuditLog />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

function Panel({
  k,
  title,
  subtitle,
  open,
  children,
}: {
  k: string;
  title: string;
  subtitle: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdminCollapsible storageKey={k} title={title} subtitle={subtitle} defaultOpen={open}>
      {children}
    </AdminCollapsible>
  );
}

type FieldRule = { min: number; max: number; integer?: boolean; label: string; help?: string };
const PRICING_RULES: Record<string, FieldRule> = {
  signup_credits: {
    min: 0,
    max: 1000,
    integer: true,
    label: "Free-tier signup OG Coins",
    help: "Granted once on first sign-in.",
  },
  coins_per_generation: {
    min: 0,
    max: 10000,
    integer: true,
    label: "Coins per song generation",
    help: "Charged when a user generates new audio tracks.",
  },
  coins_per_lyrics_generation: {
    min: 0,
    max: 10000,
    integer: true,
    label: "Coins per lyrics generation",
    help: "Charged each time AI lyrics are generated or regenerated.",
  },
  songs_per_generation: {
    min: 1,
    max: 4,
    integer: true,
    label: "Songs per generation",
    help: "How many audio variations are produced per request.",
  },
  coins_per_variation_divisor: {
    min: 1,
    max: 20,
    integer: true,
    label: "Variation cost divisor",
    help: "Reveal cost per extra variation = generation cost ÷ this number.",
  },
  sample_seconds: {
    min: 5,
    max: 600,
    integer: true,
    label: "Sample length (seconds)",
    help: "Max preview duration the player will stream.",
  },
  coins_per_full_unlock: {
    min: 0,
    max: 100000,
    integer: true,
    label: "Coins to unlock full song",
    help: "Charged when a user downloads the HQ full version.",
  },
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
  const dirty =
    !!settings &&
    Object.keys(PRICING_RULES).some((k) => String((settings as any)[k]) !== (values[k] ?? ""));

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
        {err ? (
          <p className="mt-1 text-xs text-destructive">{err}</p>
        ) : rule.help ? (
          <p className="mt-1 text-xs text-muted-foreground">{rule.help}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Coins className="h-4 w-4 text-coin" />
        <h3 className="font-semibold">Pricing & limits</h3>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
        <span className="font-bold uppercase tracking-wider text-primary">Live</span>
        <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono">
          app_settings.songs_per_generation
        </code>
        <span className="text-muted-foreground">=</span>
        <span className="font-bold text-foreground">
          {settings
            ? ((settings as { songs_per_generation?: number }).songs_per_generation ?? "—")
            : "…"}
        </span>
        <span className="text-muted-foreground">
          · edge function <code className="font-mono">suno-callback</code> reads this exact key.
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.keys(PRICING_RULES).map(renderField)}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Changes take effect for the next generation. In-flight jobs keep the pricing captured at
        request time.
      </p>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending || hasErrors || !dirty}>
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save pricing
        </Button>
      </div>
    </div>
  );
}
