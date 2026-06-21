import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Coins as CoinsIcon, Crown, Loader2, Search, Check, X as XIcon, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  email: string | null;
  display_name: string | null;
  coin_balance: number;
  roles: string[];
  interactions: number;
}

export function WidgetAccessAudit() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const dataQ = useQuery({
    queryKey: ["admin-widget-audit"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: profs, error: e1 }, { data: roles, error: e2 }, { data: txs, error: e3 }] =
        await Promise.all([
          supabase.from("profiles").select("id, email, display_name, coin_balance").order("email").limit(500),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("coin_transactions").select("user_id, type").in("type", ["generation"]),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;

      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      const txByUser = new Map<string, number>();
      (txs ?? []).forEach((t: any) => txByUser.set(t.user_id, (txByUser.get(t.user_id) ?? 0) + 1));

      return (profs ?? []).map((p: any) => ({
        id: p.id, email: p.email, display_name: p.display_name, coin_balance: p.coin_balance,
        roles: rolesByUser.get(p.id) ?? [],
        interactions: txByUser.get(p.id) ?? 0,
      }));
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = dataQ.data ?? [];
    if (!needle) return list;
    return list.filter((r) =>
      (r.email ?? "").toLowerCase().includes(needle)
      || (r.display_name ?? "").toLowerCase().includes(needle),
    );
  }, [dataQ.data, q]);

  const toggleVip = useMutation({
    mutationFn: async ({ userId, makeVip }: { userId: string; makeVip: boolean }) => {
      const { error } = await supabase.rpc("set_vip_admin", {
        target_user_id: userId, make_vip: makeVip, admin_notes: "widget_audit_toggle",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-widget-audit"] });
      toast.success("VIP status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  const setBalance = useMutation({
    mutationFn: async ({ userId, newBalance }: { userId: string; newBalance: number }) => {
      const { error } = await supabase.rpc("set_balance_admin", {
        target_user_id: userId, new_balance: newBalance, admin_notes: "widget_audit_adjust",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-widget-audit"] });
      setEditing(null);
      toast.success("Coins updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card/70 p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">User Audit</h3>
          <p className="text-xs text-muted-foreground">
            Every user: tier, OG Bot interactions, and coin balance.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or name…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/30">
        {dataQ.isLoading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center gap-2 py-12 text-muted-foreground">
            <Bot className="h-7 w-7" />
            <p className="text-sm">No users match.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Interactions</TableHead>
                <TableHead className="text-right">Coins</TableHead>
                <TableHead className="text-center">VIP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((r) => {
                const isVip = r.roles.includes("vip");
                return (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[240px]">
                      <div className="truncate font-medium">{r.email ?? "—"}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {r.display_name ?? r.id.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        isVip ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30" : "bg-muted text-muted-foreground",
                      )}>
                        {isVip && <Crown className="h-3 w-3" />}
                        {isVip ? "VIP" : "Standard"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{r.interactions}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {editing?.id === r.id ? (
                        <form
                          className="flex items-center justify-end gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const n = parseInt(editing.value, 10);
                            if (Number.isNaN(n) || n < 0) {
                              toast.error("Enter a non-negative number");
                              return;
                            }
                            setBalance.mutate({ userId: r.id, newBalance: n });
                          }}
                        >
                          <Input
                            autoFocus
                            type="number"
                            min={0}
                            value={editing.value}
                            onChange={(e) => setEditing({ id: r.id, value: e.target.value })}
                            className="h-7 w-20 text-right text-sm"
                          />
                          <Button type="submit" size="icon" variant="ghost" className="h-7 w-7" disabled={setBalance.isPending}>
                            {setBalance.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-400" />}
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)}>
                            <XIcon className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditing({ id: r.id, value: String(r.coin_balance) })}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-muted/60"
                          title="Adjust coins"
                        >
                          <CoinsIcon className="h-3 w-3 text-amber-400" />
                          <span>{r.coin_balance}</span>
                          <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-60" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={isVip}
                        disabled={toggleVip.isPending}
                        onCheckedChange={(v) => toggleVip.mutate({ userId: r.id, makeVip: v })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
