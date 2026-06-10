import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Crown, Bot, ShieldCheck, Coins, Plus, Minus, LogOut, UserCog, Mail, Fingerprint, KeyRound, Search, UserPlus, Ban, RotateCcw, AlertCircle, CheckCircle2, Copy, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
  const { isAdmin, isVip, roles } = useRole();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [nameDirty, setNameDirty] = useState(false);
  const [balance, setBalance] = useState("");
  const [balanceDirty, setBalanceDirty] = useState(false);
  const [adjust, setAdjust] = useState("");

  useEffect(() => {
    if (profile && !nameDirty) setName(profile.display_name ?? "");
  }, [profile?.display_name, nameDirty]);
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
    window.location.replace("/auth");
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
                <Mail className="h-3 w-3" /> {user?.email}
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

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Fingerprint className="h-3.5 w-3.5" />
            <span className="font-mono truncate">{user?.id}</span>
          </div>
        </section>

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
                  <Button variant="outline" size="icon"
                    onClick={() => adjustCoins.mutate(Number.parseInt(adjust, 10))}
                    disabled={!adjust || adjustCoins.isPending}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon"
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

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">OG Bot token issuance</p>
              <CreateOgBotTokenPanel />
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Unclaimed invite codes</p>
              <IssueOgBotInvitePanel />
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Active OG Bot tokens</p>
              <ManageOgBotTokensPanel />
            </div>


            <Separator />
            <div className="flex flex-wrap gap-2">
              <Link to="/admin"><Button variant="outline" size="sm">Admin home</Button></Link>
              <Link to="/admin/users"><Button variant="outline" size="sm">Manage users</Button></Link>
              <Link to="/admin/og-bot"><Button variant="outline" size="sm">OG Bot tokens</Button></Link>
            </div>
          </section>
        )}


        {/* Redeem an invite — visible to anyone signed in */}
        <RedeemOgBotInvitePanel />

        {/* My OG Bot tokens — visible to anyone who has one issued */}
        <MyOgBotTokensSection />

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

// ─────────────────────────────────────────────────────────────────────────────
// Create OG Bot Token (inline wizard) — admin only
// ─────────────────────────────────────────────────────────────────────────────

interface GrantableProfile {
  id: string;
  email: string | null;
  display_name: string | null;
}

function CreateOgBotTokenPanel() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [wizardFor, setWizardFor] = useState<GrantableProfile | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const term = query.trim();

  const candidatesQ = useQuery({
    queryKey: ["settings-og-bot-grantable", term],
    queryFn: async (): Promise<GrantableProfile[]> => {
      let q = supabase
        .from("profiles")
        .select("id, email, display_name")
        .order("created_at", { ascending: false })
        .limit(6);
      if (term) {
        const safe = term.replace(/[%,]/g, " ");
        q = q.or(`email.ilike.%${safe}%,display_name.ilike.%${safe}%,id.ilike.%${safe}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GrantableProfile[];
    },
  });

  const grant = useMutation({
    mutationFn: async (vars: { targetUserId: string; expiresAt: string | null; makeVip: boolean }) => {
      setPendingId(vars.targetUserId);
      const { error } = await supabase.rpc("set_og_bot_admin", {
        target_user_id: vars.targetUserId,
        make_og: true,
        admin_notes: "settings_issue_wizard",
      });
      if (error) throw new Error(error.message);
      if (vars.expiresAt) {
        const { error: e2 } = await (
          supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: unknown; error: { message: string } | null }>
        )("set_og_bot_token_expiry", {
          target_user_id: vars.targetUserId,
          new_expires_at: vars.expiresAt,
          admin_notes: "settings_issue_wizard",
        });
        if (e2) throw new Error(e2.message);
      }
      if (vars.makeVip) {
        const { error: e3 } = await supabase.rpc("set_vip_admin", {
          target_user_id: vars.targetUserId,
          make_vip: true,
          admin_notes: "settings_issue_wizard",
        });
        if (e3) throw new Error(e3.message);
      }
    },
    onSuccess: () => {
      toast.success("OG Bot token issued");
      setWizardFor(null);
      qc.invalidateQueries({ queryKey: ["admin-og-bot-tokens"] });
      qc.invalidateQueries({ queryKey: ["settings-og-bot-grantable"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingId(null),
  });

  const rows = candidatesQ.data ?? [];

  return (
    <div className="rounded-xl border border-border bg-background/40 p-3 space-y-3">
      <header className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Create OG Bot token</h3>
      </header>
      <p className="text-xs text-muted-foreground">
        Pick a user, choose expiry and optional role grants. A fresh{" "}
        <code className="font-mono">ogb_…</code> token is minted.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email, name, or user id…"
          className="pl-9"
        />
      </div>
      {candidatesQ.isLoading ? (
        <div className="flex items-center justify-center py-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">No matching users.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
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
                onClick={() => setWizardFor(p)}
                disabled={grant.isPending && pendingId === p.id}
              >
                {grant.isPending && pendingId === p.id ? (
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

      <IssueTokenWizard
        profile={wizardFor}
        submitting={grant.isPending && pendingId === wizardFor?.id}
        onCancel={() => { if (!grant.isPending) setWizardFor(null); }}
        onConfirm={(expiresAt, makeVip) => {
          if (!wizardFor) return;
          grant.mutate({ targetUserId: wizardFor.id, expiresAt, makeVip });
        }}
      />
    </div>
  );
}

type WizardPreset = "30d" | "90d" | "365d" | "never" | "custom";

interface IssueTokenWizardProps {
  profile: GrantableProfile | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (expiresAt: string | null, makeVip: boolean) => void;
}

function IssueTokenWizard({ profile, submitting, onCancel, onConfirm }: IssueTokenWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [preset, setPreset] = useState<WizardPreset>("90d");
  const [customDate, setCustomDate] = useState("");
  const [makeVip, setMakeVip] = useState(false);

  useEffect(() => {
    if (profile) {
      setStep(1);
      setPreset("90d");
      setCustomDate("");
      setMakeVip(false);
    }
  }, [profile?.id]);

  if (!profile) return null;

  const presetMs: Record<Exclude<WizardPreset, "never" | "custom">, number> = {
    "30d": 30 * 86400_000,
    "90d": 90 * 86400_000,
    "365d": 365 * 86400_000,
  };

  function resolveExpiry(): string | null | "invalid" {
    if (preset === "never") return null;
    if (preset === "custom") {
      if (!customDate) return "invalid";
      return new Date(customDate).toISOString();
    }
    return new Date(Date.now() + presetMs[preset]).toISOString();
  }

  const expiryResolved = resolveExpiry();
  const expiryLabel =
    expiryResolved === "invalid"
      ? "—"
      : expiryResolved === null
      ? "Never expires"
      : new Date(expiryResolved).toLocaleString();

  function submit() {
    const exp = resolveExpiry();
    if (exp === "invalid") {
      toast.error("Pick a custom date and time");
      return;
    }
    onConfirm(exp, makeVip);
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !submitting) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Issue OG Bot token · Step {step} of 3
          </DialogTitle>
          <DialogDescription>
            {profile.display_name ?? profile.email ?? profile.id}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Choose expiry</h4>
            <div className="space-y-2 text-sm">
              {(["30d", "90d", "365d", "never", "custom"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" checked={preset === k} onChange={() => setPreset(k)} />
                  <span>
                    {k === "30d" && "Expires in 30 days"}
                    {k === "90d" && "Expires in 90 days"}
                    {k === "365d" && "Expires in 1 year"}
                    {k === "never" && "No expiry (long-lived)"}
                    {k === "custom" && "Custom date & time"}
                  </span>
                </label>
              ))}
              {preset === "custom" && (
                <Input
                  type="datetime-local"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="ml-6 w-[calc(100%-1.5rem)]"
                />
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Role grants</h4>
            <p className="text-xs text-muted-foreground">
              Every token automatically grants the <code className="font-mono">og_bot</code> role.
              Optionally also grant:
            </p>
            <label className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
              <input
                type="checkbox"
                checked={makeVip}
                onChange={(e) => setMakeVip(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium">VIP role</div>
                <div className="text-xs text-muted-foreground">
                  Grants the user VIP perks alongside the bot token.
                </div>
              </div>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Review &amp; confirm</h4>
            <div className="space-y-1 rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">User</span>
                <span className="truncate text-right">{profile.email ?? profile.id}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Expiry</span>
                <span>{expiryLabel}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Roles granted</span>
                <span>{makeVip ? "og_bot + vip" : "og_bot"}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} disabled={submitting}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              onClick={() => {
                if (step === 1 && preset === "custom" && !customDate) {
                  toast.error("Pick a custom date and time");
                  return;
                }
                setStep((s) => (s + 1) as 1 | 2 | 3);
              }}
            >
              Next
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Issue token
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manage existing OG Bot tokens (revoke / restore) — admin only
// ─────────────────────────────────────────────────────────────────────────────

interface TokenRow {
  user_id: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  profile: { email: string | null; display_name: string | null } | null;
}

function ManageOgBotTokensPanel() {
  const qc = useQueryClient();

  const tokensQ = useQuery({
    queryKey: ["settings-og-bot-tokens"],
    queryFn: async (): Promise<TokenRow[]> => {
      const { data, error } = await supabase
        .from("og_bot_tokens")
        .select("user_id, expires_at, revoked_at, last_used_at, profile:profiles!og_bot_tokens_user_id_fkey(email, display_name)")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as unknown) as TokenRow[];
    },
  });

  const [pending, setPending] = useState<string | null>(null);

  const revoke = useMutation({
    mutationFn: async (userId: string) => {
      setPending(userId);
      const { error } = await supabase.rpc("revoke_og_bot_token", {
        target_user_id: userId,
        admin_notes: "settings_revoke",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Token revoked");
      qc.invalidateQueries({ queryKey: ["settings-og-bot-tokens"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  const unrevoke = useMutation({
    mutationFn: async (userId: string) => {
      setPending(userId);
      const { error } = await supabase.rpc("unrevoke_og_bot_token", {
        target_user_id: userId,
        admin_notes: "settings_unrevoke",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Token restored");
      qc.invalidateQueries({ queryKey: ["settings-og-bot-tokens"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  const disable = useMutation({
    mutationFn: async (userId: string) => {
      setPending(userId);
      const { error } = await supabase.rpc("set_og_bot_admin", {
        target_user_id: userId,
        make_og: false,
        admin_notes: "settings_disable",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Token disabled and role removed");
      qc.invalidateQueries({ queryKey: ["settings-og-bot-tokens"] });
      qc.invalidateQueries({ queryKey: ["settings-og-bot-grantable"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  const rows = tokensQ.data ?? [];
  const now = Date.now();

  if (tokensQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        No OG Bot tokens have been issued yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.map((t) => {
        const isRevoked = !!t.revoked_at;
        const isExpired = !isRevoked && t.expires_at !== null && new Date(t.expires_at).getTime() < now;
        const status: "active" | "revoked" | "expired" = isRevoked ? "revoked" : isExpired ? "expired" : "active";
        const label = t.profile?.display_name ?? t.profile?.email ?? t.user_id;
        const isBusy = pending === t.user_id && (revoke.isPending || unrevoke.isPending || disable.isPending);
        return (
          <li key={t.user_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{label}</p>
                <StatusPill status={status} />
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                {t.profile?.email ?? "—"}
                {t.expires_at && (
                  <> · expires {new Date(t.expires_at).toLocaleDateString()}</>
                )}
                {t.last_used_at && (
                  <> · used {new Date(t.last_used_at).toLocaleDateString()}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {isBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {isRevoked ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => unrevoke.mutate(t.user_id)}
                  title="Restore token"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => revoke.mutate(t.user_id)}
                  title="Revoke token (can be restored)"
                >
                  <Ban className="mr-1.5 h-3.5 w-3.5" /> Revoke
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={isBusy}
                onClick={() => {
                  if (confirm(`Disable OG Bot for ${label}? This deletes the token and removes the role.`)) {
                    disable.mutate(t.user_id);
                  }
                }}
                title="Delete token and remove og_bot role"
              >
                Disable
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatusPill({ status }: { status: "active" | "revoked" | "expired" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
        <CheckCircle2 className="h-3 w-3" /> Active
      </span>
    );
  }
  if (status === "revoked") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
        <Ban className="h-3 w-3" /> Revoked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
      <AlertCircle className="h-3 w-3" /> Expired
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// My OG Bot tokens — personal view (RLS scopes to current user)
// ─────────────────────────────────────────────────────────────────────────────

interface MyTokenRow {
  user_id: string;
  token: string;
  created_at: string | null;
  updated_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

function MyOgBotTokensSection() {
  const { user } = useAuth();
  const { roles } = useRole();

  const myTokensQ = useQuery({
    queryKey: ["settings-my-og-bot-tokens", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<MyTokenRow[]> => {
      const { data, error } = await supabase
        .from("og_bot_tokens")
        .select("user_id, token, created_at, updated_at, expires_at, revoked_at, last_used_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MyTokenRow[];
    },
  });

  const [viewing, setViewing] = useState<MyTokenRow | null>(null);
  const [reveal, setReveal] = useState(false);

  const rows = myTokensQ.data ?? [];
  // Only show the section if the user actually has a token (keeps clutter down).
  if (myTokensQ.isLoading) return null;
  if (rows.length === 0) return null;

  const now = Date.now();
  const role = (roles as string[]).includes("og_bot") ? "og_bot" : "—";

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      toast.success("Token copied to clipboard");
    } catch {
      toast.error("Could not copy — copy manually from details");
    }
  }

  function maskTokenId(token: string) {
    // Show prefix + last 4 so it's recognisable but not full-secret.
    if (token.length <= 12) return token;
    return `${token.slice(0, 8)}…${token.slice(-4)}`;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <div>
          <h2 className="font-semibold">My OG Bot tokens</h2>
          <p className="text-xs text-muted-foreground">Personal tokens issued to your account.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Token ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const isRevoked = !!t.revoked_at;
              const isExpired = !isRevoked && t.expires_at !== null && new Date(t.expires_at).getTime() < now;
              const status: "active" | "revoked" | "expired" = isRevoked ? "revoked" : isExpired ? "expired" : "active";
              return (
                <TableRow key={t.user_id}>
                  <TableCell className="font-mono text-xs">{maskTokenId(t.token)}</TableCell>
                  <TableCell className="text-xs">{role}</TableCell>
                  <TableCell className="text-xs">
                    {t.expires_at ? new Date(t.expires_at).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell><StatusPill status={status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => copyToken(t.token)} title="Copy token">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setReveal(false); setViewing(t); }}
                        title="View details"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Details
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) { setViewing(null); setReveal(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>OG Bot token details</DialogTitle>
            <DialogDescription>Keep this secret — anyone with it can act as your bot.</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <DetailRow label="Token ID" value={maskTokenId(viewing.token)} mono />
              <DetailRow label="Role" value={role} />
              <DetailRow label="Status" value={
                viewing.revoked_at ? "Revoked"
                : viewing.expires_at && new Date(viewing.expires_at).getTime() < now ? "Expired"
                : "Active"
              } />
              <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleString() : "—"} />
              <DetailRow label="Expires" value={viewing.expires_at ? new Date(viewing.expires_at).toLocaleString() : "Never"} />
              <DetailRow label="Last used" value={viewing.last_used_at ? new Date(viewing.last_used_at).toLocaleString() : "Never"} />
              {viewing.revoked_at && (
                <DetailRow label="Revoked" value={new Date(viewing.revoked_at).toLocaleString()} />
              )}

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full token</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={reveal ? viewing.token : "•".repeat(Math.min(40, viewing.token.length))}
                    className="font-mono text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={() => setReveal((r) => !r)}>
                    {reveal ? "Hide" : "Reveal"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyToken(viewing.token)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setViewing(null); setReveal(false); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-xs ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue an unclaimed OG Bot invite — admin only
// First user to redeem the code gets the og_bot role and a fresh token whose
// expiry was preset here at creation time.
// ─────────────────────────────────────────────────────────────────────────────

interface InviteRow {
  id: string;
  code: string;
  created_at: string | null;
  claim_expires_at: string | null;
  token_expires_at: string | null;
  notes: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  revoked_at: string | null;
}

function IssueOgBotInvitePanel() {
  const qc = useQueryClient();
  const [claimDays, setClaimDays] = useState("7");
  const [tokenDays, setTokenDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [lastCode, setLastCode] = useState<string | null>(null);

  const invitesQ = useQuery({
    queryKey: ["settings-og-bot-invites"],
    queryFn: async (): Promise<InviteRow[]> => {
      const { data, error } = await supabase
        .from("og_bot_token_invites")
        .select("id, code, created_at, claim_expires_at, token_expires_at, notes, redeemed_by, redeemed_at, revoked_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as InviteRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const claimN = Number(claimDays);
      const tokenN = Number(tokenDays);
      const claimExp = claimN > 0 ? new Date(Date.now() + claimN * 86400_000).toISOString() : null;
      const tokenExp = tokenN > 0 ? new Date(Date.now() + tokenN * 86400_000).toISOString() : null;
      const { data, error } = await supabase.rpc("create_og_bot_invite", {
        p_claim_expires_at: claimExp ?? undefined,
        p_token_expires_at: tokenExp ?? undefined,
        p_notes: notes || undefined,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: (code) => {
      setLastCode(code);
      setNotes("");
      toast.success("Invite code created");
      qc.invalidateQueries({ queryKey: ["settings-og-bot-invites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_og_bot_invite", { p_invite_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Invite revoked");
      qc.invalidateQueries({ queryKey: ["settings-og-bot-invites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  const rows = invitesQ.data ?? [];
  const now = Date.now();

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Claim window (days)</Label>
          <Input type="number" min={0} value={claimDays} onChange={(e) => setClaimDays(e.target.value)} placeholder="0 = never" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Token expiry (days)</Label>
          <Input type="number" min={0} value={tokenDays} onChange={(e) => setTokenDays(e.target.value)} placeholder="0 = never" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional label" />
        </div>
      </div>
      <Button onClick={() => create.mutate()} disabled={create.isPending} size="sm">
        {create.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
        Generate claim code
      </Button>

      {lastCode && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">New code — copy now</p>
          <div className="mt-1 flex items-center gap-2">
            <Input readOnly value={lastCode} className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => copy(lastCode)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {invitesQ.isLoading ? (
        <div className="flex items-center justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          No invite codes yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((inv) => {
            const isRedeemed = !!inv.redeemed_at;
            const isRevoked = !!inv.revoked_at;
            const isExpired = !isRedeemed && !isRevoked && inv.claim_expires_at !== null && new Date(inv.claim_expires_at).getTime() < now;
            const status: "active" | "revoked" | "expired" | "redeemed" =
              isRedeemed ? "redeemed" : isRevoked ? "revoked" : isExpired ? "expired" : "active";
            return (
              <li key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="truncate font-mono text-xs">{inv.code.slice(0, 12)}…{inv.code.slice(-4)}</code>
                    <InviteStatusPill status={status} />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {inv.notes ? `${inv.notes} · ` : ""}
                    claim {inv.claim_expires_at ? `by ${new Date(inv.claim_expires_at).toLocaleDateString()}` : "anytime"}
                    {" · "}
                    token {inv.token_expires_at ? `expires ${new Date(inv.token_expires_at).toLocaleDateString()}` : "never expires"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => copy(inv.code)} title="Copy code">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {status === "active" && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("Revoke this invite code?")) revoke.mutate(inv.id); }}>
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function InviteStatusPill({ status }: { status: "active" | "revoked" | "expired" | "redeemed" }) {
  if (status === "active") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500"><CheckCircle2 className="h-3 w-3" /> Open</span>;
  }
  if (status === "redeemed") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"><CheckCircle2 className="h-3 w-3" /> Redeemed</span>;
  }
  if (status === "revoked") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"><Ban className="h-3 w-3" /> Revoked</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500"><AlertCircle className="h-3 w-3" /> Expired</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redeem an invite — any signed-in user
// ─────────────────────────────────────────────────────────────────────────────

function RedeemOgBotInvitePanel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<string | null>(null);

  const redeem = useMutation({
    mutationFn: async () => {
      const trimmed = code.trim();
      if (!trimmed) throw new Error("Paste an invite code");
      const { data, error } = await supabase.rpc("redeem_og_bot_invite", { p_code: trimmed });
      if (error) throw new Error(humaniseRedeemError(error.message));
      return data as string;
    },
    onSuccess: (token) => {
      setIssued(token);
      setCode("");
      toast.success("Invite redeemed — token issued");
      qc.invalidateQueries({ queryKey: ["settings-my-og-bot-tokens", user?.id] });
      qc.invalidateQueries({ queryKey: ["settings-og-bot-invites"] });
      qc.invalidateQueries({ queryKey: ["role", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Token copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <div>
          <h2 className="font-semibold">Redeem an OG Bot invite</h2>
          <p className="text-xs text-muted-foreground">
            First user to claim a code gets the bot token with whatever rights the boss set on it.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ogi_…"
          className="font-mono text-xs"
          onKeyDown={(e) => { if (e.key === "Enter") redeem.mutate(); }}
        />
        <Button onClick={() => redeem.mutate()} disabled={redeem.isPending}>
          {redeem.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-2 h-3.5 w-3.5" />}
          Redeem
        </Button>
      </div>

      {issued && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">Your new bot token — copy now</p>
          <div className="mt-1 flex items-center gap-2">
            <Input readOnly value={issued} className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => copy(issued)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function humaniseRedeemError(msg: string): string {
  if (msg.includes("invite_not_found")) return "Invite code not found.";
  if (msg.includes("invite_revoked")) return "This invite has been revoked.";
  if (msg.includes("invite_already_redeemed")) return "This invite has already been claimed.";
  if (msg.includes("invite_expired")) return "This invite has expired.";
  if (msg.includes("not_authenticated")) return "Sign in to redeem an invite.";
  return msg;
}
