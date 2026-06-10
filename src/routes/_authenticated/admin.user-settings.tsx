import { createFileRoute, Navigate, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Search, ArrowLeft, UserCog, Crown, Coins, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { VipBadgeAction } from "@/components/admin/VipBadgeAction";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/user-settings")({
  // Strict server-side authorization: the user must be authenticated AND
  // have the 'admin' role. The has_role() RPC is SECURITY DEFINER and runs
  // against the caller's auth.uid(); failing the check redirects away.
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (error || !isAdmin) throw redirect({ to: "/" });
  },
  component: AdminUserSettingsPage,
});


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

function AdminUserSettingsPage() {
  const { isAdmin, isLoading } = useRole();
  const [search, setSearch] = useState("");

  const profilesQ = useQuery({
    queryKey: ["admin-user-settings-profiles"],
    enabled: isAdmin,
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, coin_balance, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["admin-user-settings-roles"],
    enabled: isAdmin,
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const rolesByUser = useMemo(() => {
    const map = new Map<string, string[]>();
    (rolesQ.data ?? []).forEach((r) => {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role);
      map.set(r.user_id, arr);
    });
    return map;
  }, [rolesQ.data]);

  const filtered = useMemo(() => {
    const list = profilesQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.display_name ?? "").toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [profilesQ.data, search]);

  if (isLoading) {
    return (
      <DashboardShell title="User Settings">
        <div className="grid h-64 place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  const totalCoins = (profilesQ.data ?? []).reduce((sum, p) => sum + (p.coin_balance ?? 0), 0);
  const totalVip = (rolesQ.data ?? []).filter((r) => r.role === "vip").length;

  return (
    <DashboardShell title="User Settings">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Admin
              </Button>
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Boss view
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<UserCog className="h-4 w-4" />} label="Total users" value={profilesQ.data?.length ?? 0} />
          <StatCard icon={<Coins className="h-4 w-4 text-coin" />} label="Coins in circulation" value={totalCoins} />
          <StatCard icon={<Crown className="h-4 w-4 text-amber-500" />} label="VIP members" value={totalVip} />
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">All user settings</h2>
              <p className="text-sm text-muted-foreground">Read-only view of each user's account profile.</p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email, name, or id"
                className="pl-9"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Display name</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Coins</TableHead>
                  <TableHead>Adjust coins</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>User ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profilesQ.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No users match your search.
                    </TableCell>
                  </TableRow>

                ) : (
                  filtered.map((p) => {
                    const roles = rolesByUser.get(p.id) ?? [];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.email ?? "—"}</TableCell>
                        <TableCell>{p.display_name ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {roles.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              roles.map((r) => (
                                <span
                                  key={r}
                                  className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                                >
                                  {r}
                                </span>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{p.coin_balance ?? 0}</TableCell>
                        <TableCell><AdjustCoinsCell userId={p.id} email={p.email ?? p.id} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{p.id.slice(0, 8)}…</TableCell>
                      </TableRow>

                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

function AdjustCoinsCell({ userId, email }: { userId: string; email: string }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<string>("");

  const adjust = useMutation({
    mutationFn: async (delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) throw new Error("Enter a non-zero amount");
      if (Math.abs(delta) > 100000) throw new Error("Max ±100,000 per adjustment");
      const { data, error } = await supabase.rpc("mint_coins_admin", {
        target_user_id: userId,
        amount: delta,
        admin_notes: `admin_adjust:${email}`,
      });
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (newBalance, delta) => {
      toast.success(`${delta > 0 ? "+" : ""}${delta} coins · new balance ${newBalance}`);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["admin-user-settings-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const parsed = Number.parseInt(amount, 10);
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={1}
        max={100000}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
        className="h-8 w-20 text-sm"
        disabled={adjust.isPending}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-2"
        disabled={!valid || adjust.isPending}
        onClick={() => adjust.mutate(parsed)}
        title="Add coins"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-2"
        disabled={!valid || adjust.isPending}
        onClick={() => adjust.mutate(-parsed)}
        title="Subtract coins"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      {adjust.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}

