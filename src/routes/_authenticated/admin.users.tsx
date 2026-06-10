import { createFileRoute, Navigate, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, ShieldCheck, Search, ArrowLeft, Users as UsersIcon,
  UserCog, Crown, Coins, Settings as SettingsIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AdminEditModeToggle } from "@/components/admin/AdminEditMode";
import { BulkReconcilePanel } from "@/components/admin/BulkReconcilePanel";

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (error || !isAdmin) throw redirect({ to: "/" });
  },
  component: AdminUsersPage,
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

function AdminUsersPage() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const [q, setQ] = useState("");

  const usersQ = useQuery({
    queryKey: ["admin-users-list"],
    enabled: isAdmin,
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, coin_balance, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["admin-users-roles"],
    enabled: isAdmin,
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
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
    const needle = q.trim().toLowerCase();
    const list = usersQ.data ?? [];
    if (!needle) return list;
    return list.filter((u) =>
      (u.email ?? "").toLowerCase().includes(needle)
      || (u.display_name ?? "").toLowerCase().includes(needle)
      || u.id.toLowerCase().includes(needle),
    );
  }, [usersQ.data, q]);

  if (roleLoading) {
    return (
      <DashboardShell title="Users">
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  const totalCoins = (usersQ.data ?? []).reduce((sum, p) => sum + (p.coin_balance ?? 0), 0);
  const totalVip = (rolesQ.data ?? []).filter((r) => r.role === "vip").length;

  return (
    <DashboardShell title="Users">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Manage users</h2>
            <p className="text-sm text-muted-foreground">
              Search, view, and open per-user settings. Each user has their own settings page
              with VIP toggle, label, balance, and full audit trail.
            </p>
          </div>
          <AdminEditModeToggle />
          <Link to="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to admin
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<UserCog className="h-4 w-4" />} label="Total users" value={usersQ.data?.length ?? 0} />
          <StatCard icon={<Coins className="h-4 w-4 text-coin" />} label="Coins in circulation" value={totalCoins} />
          <StatCard icon={<Crown className="h-4 w-4 text-amber-500" />} label="VIP members" value={totalVip} />
        </div>

        <BulkReconcilePanel />

        <div className="flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {usersQ.data ? `${filtered.length} of ${usersQ.data.length} users` : ""}
          </span>
          <div className="ml-auto relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email, name, or id…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card">
          {usersQ.isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Display name</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const roles = rolesByUser.get(u.id) ?? [];
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-[260px]">
                        <div className="truncate font-medium">{u.email ?? "—"}</div>
                        <div className="truncate font-mono text-[10px] text-muted-foreground">{u.id.slice(0, 8)}…</div>
                      </TableCell>
                      <TableCell>{u.display_name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{u.coin_balance ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">user</span>
                          ) : roles.map((r) => (
                            <span
                              key={r}
                              className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to="/admin/users/$userId" params={{ userId: u.id }}>
                          <Button size="sm" variant="outline">
                            <SettingsIcon className="mr-1.5 h-3.5 w-3.5" /> Settings
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="grid place-items-center gap-2 py-16 text-muted-foreground">
              <UsersIcon className="h-8 w-8" />
              <p>No users match.</p>
            </div>
          )}
        </div>
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
