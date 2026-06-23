import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Crown, Bot, ShieldCheck, Coins, Plus, Minus, LogOut, UserCog, Mail, Fingerprint, KeyRound, Send, Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDevMode } from "@/hooks/use-dev-mode";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { PreferencesPanel } from "@/components/settings/PreferencesPanel";
import { VipStatusCard } from "@/components/settings/VipStatusCard";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const dev = useDevMode();
  const { data: profile, refetch } = useProfile();
  const { isAdmin, isVip, roles } = useRole();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [nameDirty, setNameDirty] = useState(false);
  const [balance, setBalance] = useState("");
  const [balanceDirty, setBalanceDirty] = useState(false);
  const [adjust, setAdjust] = useState("");

  useEffect(() => {
    if (profile && !nameDirty) setName(profile.display_name ?? (dev.isDev ? "Developer" : ""));
  }, [profile?.display_name, nameDirty, dev.isDev]);
  useEffect(() => {
    if (profile && !balanceDirty) setBalance(String(profile.coin_balance ?? 0));
  }, [profile?.coin_balance, balanceDirty]);

  const isOgBot = (roles as string[]).includes("og_bot");

  const saveName = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Display name required");
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: trimmed })
        .eq("id", user!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Display name updated");
      setNameDirty(false);
      refetch();
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBalance = useMutation({
    mutationFn: async () => {
      const n = Number.parseInt(balance, 10);
      if (!Number.isFinite(n) || n < 0) throw new Error("Enter a valid balance");
      const { data, error } = await supabase.rpc("set_balance_admin", {
        target_user_id: user!.id,
        new_balance: n,
        admin_notes: "self_settings_set",
      });
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: () => {
      toast.success("Balance set");
      setBalanceDirty(false);
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustCoins = useMutation({
    mutationFn: async (delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) throw new Error("Enter a non-zero amount");
      const { data, error } = await supabase.rpc("mint_coins_admin", {
        target_user_id: user!.id,
        amount: delta,
        admin_notes: "self_settings_adjust",
      });
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (newBal, delta) => {
      toast.success(`${delta > 0 ? "+" : ""}${delta} coins · ${newBal}`);
      setAdjust("");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRole = useMutation({
    mutationFn: async ({ rpc, key, value }: { rpc: "set_vip_admin" | "set_og_bot_admin"; key: "make_vip" | "make_og"; value: boolean }) => {
      const args: Record<string, unknown> = { target_user_id: user!.id, admin_notes: "self_settings_toggle" };
      args[key] = value;
      const { error } = await supabase.rpc(rpc as never, args as never);
      if (error) throw new Error(error.message);
      return value;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-role", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    window.location.replace("/welcome");
  };

  return (
    <DashboardShell title="Settings">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Identity */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
          <header className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand">
              <UserCog className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold">Profile</h2>
              <p className="truncate text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> {dev.isDev ? "developer@local" : user?.email}
              </p>
            </div>
          </header>

          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameDirty(true); }}
                maxLength={80}
                placeholder="Your name"
              />
              <Button onClick={() => saveName.mutate()} disabled={!nameDirty || saveName.isPending}>
                {saveName.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Fingerprint className="h-3.5 w-3.5" />
              <span className="font-mono truncate max-w-[18ch]">{user?.id}</span>
            </span>
            {(() => {
              const provider = user?.app_metadata?.provider as string | undefined;
              if (!provider) return null;
              return (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2 py-0.5 capitalize">
                  <KeyRound className="h-3 w-3" /> Signed in with {provider}
                </span>
              );
            })()}
          </div>
        </section>

        {/* Preferences — assistant, music, appearance */}
        <VipStatusCard />
        <PreferencesPanel />


        {/* Coins */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-coin" />
              <h2 className="font-semibold">Coins</h2>
            </div>
            <span className="text-lg font-semibold">{profile?.coin_balance ?? 0}</span>
          </header>

          {isAdmin ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="set-bal">Set balance</Label>
                <div className="flex gap-2">
                  <Input id="set-bal" type="number" min={0} value={balance}
                    onChange={(e) => { setBalance(e.target.value); setBalanceDirty(true); }} />
                  <Button onClick={() => saveBalance.mutate()} disabled={!balanceDirty || saveBalance.isPending}>
                    {saveBalance.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Set
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adj-bal">Adjust by</Label>
                <div className="flex gap-2">
                  <Input id="adj-bal" type="number" min={1} value={adjust}
                    onChange={(e) => setAdjust(e.target.value)} placeholder="0" />
                  <Button variant="outline" size="icon" aria-label="Add coins"
                    onClick={() => adjustCoins.mutate(Number.parseInt(adjust, 10))}
                    disabled={!adjust || adjustCoins.isPending}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Subtract coins"
                    onClick={() => adjustCoins.mutate(-Number.parseInt(adjust, 10))}
                    disabled={!adjust || adjustCoins.isPending}>
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Need more coins? <Link to="/buy-coins" className="text-primary underline">Top up</Link>.
            </p>
          )}
        </section>

        {/* Roles (admin only) */}
        {isAdmin && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
            <header className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold leading-tight">Roles & access</h2>
                <p className="text-xs text-muted-foreground">Toggle perks for yourself and mint tokens for others.</p>
              </div>
            </header>

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your roles</p>
              <RoleRow
                icon={<Crown className="h-5 w-5 text-amber-500" />}
                title="VIP"
                description="Premium tiers and bonus features."
                checked={isVip}
                pending={toggleRole.isPending}
                onChange={(v) => toggleRole.mutate({ rpc: "set_vip_admin", key: "make_vip", value: v })}
              />
              <RoleRow
                icon={<Bot className="h-5 w-5 text-primary" />}
                title="OG Bot"
                description="Automated/bot privileges."
                checked={isOgBot}
                pending={toggleRole.isPending}
                onChange={(v) => toggleRole.mutate({ rpc: "set_og_bot_admin", key: "make_og", value: v })}
              />
              <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3 opacity-80">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <div>
                    <Label className="text-sm font-medium">Boss / admin</Label>
                    <p className="text-xs text-muted-foreground">Provisioned in the database.</p>
                  </div>
                </div>
                <Switch checked disabled />
              </div>
            </div>

            <Separator />
            <div className="flex flex-wrap gap-2">
              <Link to="/admin"><Button variant="outline" size="sm">Admin home</Button></Link>
              <Link to="/admin/users"><Button variant="outline" size="sm">Manage users</Button></Link>
            </div>
          </section>
        )}

        {/* Connect Telegram */}
        <TelegramConnectSection userId={user?.id ?? ""} />


        {/* Session */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Session</h2>
            <p className="text-xs text-muted-foreground">Sign out of this device.</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </section>
      </div>
    </DashboardShell>
  );
}

function RoleRow({ icon, title, description, checked, pending, onChange }: {
  icon: React.ReactNode; title: string; description: string;
  checked: boolean; pending: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <Label className="text-sm font-medium">{title}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Switch checked={checked} disabled={pending} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

const TELEGRAM_BOT_USERNAME = "OGStreamzBot";

function TelegramConnectSection({ userId }: { userId: string }) {
  const token = userId ? userId.replace(/-/g, "").slice(0, 24) : "";
  const link = userId
    ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`
    : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied — paste it into Telegram");
    } catch {
      toast.error("Couldn't copy. Long-press to copy instead.");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Send className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Connect Telegram</h2>
          <p className="text-xs text-muted-foreground">
            Chat with OG Bot from Telegram about literally anything — random shit, lyrics, life advice, 3am thoughts. Tap the button, hit Start, you're in.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-border bg-background/40 p-3">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Your personal connect link
        </Label>
        <div className="mt-1 flex items-center gap-2">
          <Input readOnly value={link} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={copy} title="Copy link" aria-label="Copy connect link">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          asChild
          disabled={!link}
          className="bg-[#229ED9] font-semibold text-white hover:bg-[#229ED9]/90"
        >
          <a href={link || "#"} target="_blank" rel="noreferrer">
            <Send className="mr-2 h-4 w-4" /> Open in Telegram
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`https://t.me/${TELEGRAM_BOT_USERNAME}`} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" /> Find @{TELEGRAM_BOT_USERNAME}
          </a>
        </Button>
      </div>
    </section>
  );
}

