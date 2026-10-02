import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  Coins,
  HeartPulse,
  KeyRound,
  Loader2,
  Map,
  Music2,
  Radio,
  Rocket,
  Save,
  Scale,
  Settings2,
  Share2,
  Store,
  Users,
  Webhook,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminPanel,
});

const PAGE_LINKS = [
  { to: "/admin/users", label: "Users", desc: "Roles, coins, VIP, accounts", Icon: Users },
  { to: "/admin/store", label: "Store", desc: "Products & prices", Icon: Store },
  { to: "/admin/og-persona", label: "OG persona", desc: "Bot personality", Icon: Bot },
  { to: "/admin/onboarding", label: "Onboarding", desc: "Welcome flow", Icon: Rocket },
  { to: "/admin/system", label: "System", desc: "Runtime status", Icon: Settings2 },
  { to: "/admin/health", label: "API health", desc: "Provider checks", Icon: HeartPulse },
  { to: "/admin/webhooks", label: "Webhooks", desc: "Delivery logs", Icon: Webhook },
  { to: "/admin/coin-audit", label: "Coin audit", desc: "Coin ledger checks", Icon: Coins },
  { to: "/admin/referrals-audit", label: "Referrals audit", desc: "Commission checks", Icon: Share2 },
  { to: "/admin/audit", label: "Audit", desc: "Boss actions", Icon: Scale },
  { to: "/admin/api-keys", label: "API keys", desc: "Key status", Icon: KeyRound },
  { to: "/admin/route-map", label: "Route map", desc: "All app pages", Icon: Map },
  { to: "/developer", label: "Live users", desc: "Who's online", Icon: Radio },
] as const;

function AdminPanel() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const [openSection, setOpenSection] = useState<string | null>("music");

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

  const section = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((cur) => (cur === id ? null : id)),
  });

  return (
    <DashboardShell title="Admin Controls">
      <BossNav />
      <div className="mx-auto mt-4 w-full min-w-0 max-w-5xl space-y-4">
        <header className="min-w-0">
          <h1 className="font-display text-xl font-black leading-tight sm:text-2xl">
            Boss Control Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Tap a section to open it. Only one stays open at a time.
          </p>
        </header>

        <BossKpiStrip />
        <ProviderPulse />

        <div className="space-y-3">
          <Section id="music" title="Music desk" desc="Live tracks, retries, locks" Icon={Music2} {...section("music")}>
            <MusicDesk />
          </Section>

          <Section id="economy" title="Coins & pricing" desc="Balances, minting, pricing rules" Icon={Coins} {...section("economy")}>
            <Panel group="economy" k="og-coins" title="OG Coins overview" subtitle="Balances in circulation" open>
              <OgCoinsPanel />
            </Panel>
            <Panel group="economy" k="mint" title="Mint coins" subtitle="Grant coins to a user">
              <MintCoinsPanel />
            </Panel>
            <Panel group="economy" k="pricing" title="Pricing & limits" subtitle="Generation and unlock costs">
              <PricingControls />
            </Panel>
          </Section>

          <Section id="bot" title="Bot & Telegram" desc="OG Bot, webhook, DMs" Icon={Bot} {...section("bot")}>
            <Panel group="bot" k="og-bot-ping" title="OG Bot ping" subtitle="Check OG Bot is reachable" open>
              <OgBotPing />
            </Panel>
            <Panel group="bot" k="telegram-webhook" title="Telegram webhook" subtitle="Live delivery status">
              <TelegramWebhookStatus />
            </Panel>
            <Panel group="bot" k="telegram-smoke" title="Telegram smoke test" subtitle="Bot + webhook check">
              <TelegramSmokeTest />
            </Panel>
            <Panel group="bot" k="boss-notifs" title="Boss DM notifications" subtitle="What gets sent to you">
              <BossNotificationsPanel />
            </Panel>
          </Section>

          <Section id="system" title="App & diagnostics" desc="Feature switches and tests" Icon={Settings2} {...section("system")}>
            <Panel group="system" k="app-toggles" title="App toggles" subtitle="Global feature switches" open>
              <AppToggles />
            </Panel>
            <Panel group="system" k="portals" title="Portals" subtitle="Manage portal definitions">
              <PortalManager />
            </Panel>
            <Panel group="system" k="e2e-smoke" title="End-to-end test" subtitle="Full app flow">
              <E2ESmokeTest />
            </Panel>
            <Panel group="system" k="foul-smoke" title="Foul-mouth test" subtitle="VIP gating + reply quality">
              <FoulMouthSmokeTest />
            </Panel>
            <Panel group="system" k="capabilities" title="Hardwired capabilities" subtitle="Runtime status">
              <HardwiredCapabilities />
            </Panel>
          </Section>

          <Section id="pages" title="Users, store & tools" desc="Every other admin page" Icon={Users} {...section("pages")}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PAGE_LINKS.map(({ to, label, desc, Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5 transition hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">{label}</span>
                    <span className="block text-xs leading-snug text-muted-foreground">{desc}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </Section>

          <Section id="activity" title="Audit log" desc="Recent Boss actions" Icon={Activity} {...section("activity")}>
            <BossAuditLog />
          </Section>
        </div>
      </div>
    </DashboardShell>
  );
}

function Section({
  id,
  title,
  desc,
  Icon,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`boss-${id}`}
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border bg-card/70 shadow-card transition-colors",
        open ? "border-primary/50" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => {
          onToggle();
          if (!open) {
            requestAnimationFrame(() =>
              document.getElementById(`boss-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
            );
          }
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-muted/40"
      >
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            open ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold leading-tight">{title}</span>
          <span className="block text-xs leading-snug text-muted-foreground">{desc}</span>
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="min-w-0 border-t border-border/60 p-2 sm:p-4">{children}</div>}
    </section>
  );
}

function Panel({
  k,
  group,
  title,
  subtitle,
  open,
  children,
}: {
  k: string;
  group: string;
  title: string;
  subtitle: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdminCollapsible storageKey={k} group={group} title={title} subtitle={subtitle} defaultOpen={open}>
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
    <div className="min-w-0 p-1 sm:p-2">
      <div className="mb-3 flex items-center gap-2">
        <Coins className="h-4 w-4 text-coin" />
        <h3 className="font-semibold">Pricing & limits</h3>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 break-all rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
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
