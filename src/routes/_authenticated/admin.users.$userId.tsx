import { createFileRoute, Navigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, ShieldCheck, ArrowLeft, Crown, Coins, Plus, Minus, UserCog, Mail, Calendar, Fingerprint, Bot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UserAuditTrail } from "@/components/admin/UserAuditTrail";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users/$userId")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (error || !isAdmin) throw redirect({ to: "/" });
  },
  component: UserSettingsPage,
});

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  coin_balance: number;
  created_at: string;
}

function UserSettingsPage() {
  const { userId } = Route.useParams();
  const { isAdmin, isLoading } = useRole();
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["admin-user-profile", userId],
    enabled: isAdmin,
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, coin_balance, created_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ProfileRow | null;
    },
  });

  const rolesQ = useQuery({
    queryKey: ["admin-user-roles", userId],
    enabled: isAdmin,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as string);
    },
  });

  const [label, setLabel] = useState<string>("");
  const [labelDirty, setLabelDirty] = useState(false);
  const [balance, setBalance] = useState<string>("");
  const [balanceDirty, setBalanceDirty] = useState(false);
  const [adjust, setAdjust] = useState<string>("");

  // Hydrate inputs when profile loads
  if (profileQ.data && !labelDirty && label === "") {
    if (profileQ.data.display_name) setLabel(profileQ.data.display_name);
  }
  if (profileQ.data && !balanceDirty && balance === "") {
    setBalance(String(profileQ.data.coin_balance ?? 0));
  }

  const saveLabel = useMutation({
    mutationFn: async () => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Display name required");
      const { data, error } = await supabase.rpc("admin_update_profile_label", {
        target_user_id: userId,
        new_display_name: trimmed,
        admin_notes: "settings_page",
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      toast.success("Display name updated");
      setLabelDirty(false);
      qc.invalidateQueries({ queryKey: ["admin-user-profile", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBalance = useMutation({
    mutationFn: async () => {
      const n = Number.parseInt(balance, 10);
      if (!Number.isFinite(n) || n < 0) throw new Error("Enter a valid balance");
      const { data, error } = await supabase.rpc("set_balance_admin", {
        target_user_id: userId,
        new_balance: n,
        admin_notes: "settings_page_set",
      });
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: () => {
      toast.success("Balance set");
      setBalanceDirty(false);
      qc.invalidateQueries({ queryKey: ["admin-user-profile", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustCoins = useMutation({
    mutationFn: async (delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) throw new Error("Enter a non-zero amount");
      if (Math.abs(delta) > 100000) throw new Error("Max ±100,000 per adjustment");
      const { data, error } = await supabase.rpc("mint_coins_admin", {
        target_user_id: userId,
        amount: delta,
        admin_notes: "settings_page_adjust",
      });
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (newBalance, delta) => {
      toast.success(`${delta > 0 ? "+" : ""}${delta} coins · new balance ${newBalance}`);
      setAdjust("");
      qc.invalidateQueries({ queryKey: ["admin-user-profile", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || profileQ.isLoading) {
    return (
      <DashboardShell title="User settings">
        <div className="grid h-64 place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  const profile = profileQ.data;
  if (!profile) {
    return (
      <DashboardShell title="User settings">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">User not found.</p>
          <Link to="/admin/users">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to users
            </Button>
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const roles = rolesQ.data ?? [];
  const isVip = roles.includes("vip");
  const isAdminUser = roles.includes("admin");

  const adjustParsed = Number.parseInt(adjust, 10);
  const adjustValid = Number.isFinite(adjustParsed) && adjustParsed > 0;

  return (
    <DashboardShell title="User settings">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand">
            <UserCog className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="truncate font-semibold">{profile.display_name ?? profile.email ?? "Unnamed user"}</h2>
            <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
          </div>
          <Link to="/admin/users">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> All users
            </Button>
          </Link>
        </div>

        {/* Overview */}
        <section className="grid gap-4 sm:grid-cols-3">
          <InfoCard icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email ?? "—"} />
          <InfoCard icon={<Coins className="h-4 w-4 text-coin" />} label="Balance" value={String(profile.coin_balance ?? 0)} />
          <InfoCard icon={<Calendar className="h-4 w-4" />} label="Joined" value={new Date(profile.created_at).toLocaleDateString()} />
        </section>

        {/* Identity */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
          <header>
            <h3 className="font-semibold">Identity</h3>
            <p className="text-sm text-muted-foreground">Display label shown across the app.</p>
          </header>
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={label}
                onChange={(e) => { setLabel(e.target.value); setLabelDirty(true); }}
                maxLength={80}
                placeholder="No label"
              />
              <Button
                onClick={() => saveLabel.mutate()}
                disabled={!labelDirty || saveLabel.isPending}
              >
                {saveLabel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Fingerprint className="h-3.5 w-3.5" />
            <span className="font-mono">{profile.id}</span>
          </div>
        </section>

        {/* Roles & access */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
          <header>
            <h3 className="font-semibold">Roles & access</h3>
            <p className="text-sm text-muted-foreground">Grant VIP perks, OG Bot access, and review role assignments.</p>
          </header>

          <RoleToggleRow
            icon={<Crown className="h-5 w-5 text-amber-500" />}
            title="VIP member"
            description="Unlocks premium tiers and bonus features."
            checked={isVip}
            userId={profile.id}
            role="vip"
            rpc="set_vip_admin"
            paramKey="make_vip"
          />

          <RoleToggleRow
            icon={<Bot className="h-5 w-5 text-primary" />}
            title="OG Bot access"
            description="Grants automated/bot privileges across the site."
            checked={roles.includes("og_bot")}
            userId={profile.id}
            role="og_bot"
            rpc="set_og_bot_admin"
            paramKey="make_og"
          />

          <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-4 opacity-80">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <Label className="text-sm font-medium">Boss / admin</Label>
                <p className="text-xs text-muted-foreground">Provisioned in the database for security.</p>
              </div>
            </div>
            <Switch checked={isAdminUser} disabled />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {roles.length === 0 ? (
              <span className="text-xs text-muted-foreground">No extra roles</span>
            ) : roles.map((r) => (
              <span key={r} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                {r}
              </span>
            ))}
          </div>
        </section>

        {/* Coins */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
          <header>
            <h3 className="font-semibold">Coin balance</h3>
            <p className="text-sm text-muted-foreground">Set an exact balance, or adjust by a delta. All changes are audited.</p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="set-balance">Set exact balance</Label>
              <div className="flex gap-2">
                <Input
                  id="set-balance"
                  type="number"
                  min={0}
                  max={100000000}
                  value={balance}
                  onChange={(e) => { setBalance(e.target.value); setBalanceDirty(true); }}
                />
                <Button onClick={() => saveBalance.mutate()} disabled={!balanceDirty || saveBalance.isPending}>
                  {saveBalance.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjust-balance">Adjust by amount</Label>
              <div className="flex gap-2">
                <Input
                  id="adjust-balance"
                  type="number"
                  min={1}
                  max={100000}
                  value={adjust}
                  onChange={(e) => setAdjust(e.target.value)}
                  placeholder="0"
                />
                <Button
                  variant="outline"
                  onClick={() => adjustCoins.mutate(adjustParsed)}
                  disabled={!adjustValid || adjustCoins.isPending}
                  title="Add coins"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => adjustCoins.mutate(-adjustParsed)}
                  disabled={!adjustValid || adjustCoins.isPending}
                  title="Subtract coins"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Audit */}
        <UserAuditTrail userId={profile.id} email={profile.email} />
      </div>
    </DashboardShell>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="mt-2 truncate text-base font-semibold">{value}</div>
    </div>
  );
}
