import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Search, ArrowLeft, Users as UsersIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AdminEditableLabel,
  AdminEditableBalance,
  AdminEditModeToggle,
} from "@/components/admin/AdminEditMode";
import { BulkReconcilePanel } from "@/components/admin/BulkReconcilePanel";
import { UserAuditTrail } from "@/components/admin/UserAuditTrail";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  coin_balance: number;
  created_at: string;
}

function AdminUsersPage() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selected = useMemo(
    () => (usersQ.data ?? []).find((u) => u.id === selectedId) ?? null,
    [usersQ.data, selectedId],
  );

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

  return (
    <DashboardShell title="Users">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">User labels & balances</h2>
            <p className="text-sm text-muted-foreground">
              Edit display names and coin balances. Every change is logged to the audit trail
              and synced across dashboard & library views.
            </p>
          </div>
          <AdminEditModeToggle />
          <Link to="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to admin
            </Button>
          </Link>
        </div>

        <BulkReconcilePanel />

        <div className="mb-3 flex items-center gap-2">
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
                  <TableHead>Display label</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Audit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} data-state={selectedId === u.id ? "selected" : undefined}>
                    <TableCell className="max-w-[260px]">
                      <div className="truncate font-medium">{u.email ?? "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.id.slice(0, 8)}…</div>
                    </TableCell>
                    <TableCell>
                      <AdminEditableLabel userId={u.id} value={u.display_name} fallback="No label" />
                    </TableCell>
                    <TableCell className="text-right">
                      <AdminEditableBalance userId={u.id} value={u.coin_balance} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={selectedId === u.id ? "default" : "outline"}
                        onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}
                      >
                        {selectedId === u.id ? "Hide" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid place-items-center gap-2 py-16 text-muted-foreground">
              <UsersIcon className="h-8 w-8" />
              <p>No users match.</p>
            </div>
          )}
        </div>

        {selected && (
          <UserAuditTrail userId={selected.id} email={selected.email} />
        )}
      </div>
    </DashboardShell>
  );
}
