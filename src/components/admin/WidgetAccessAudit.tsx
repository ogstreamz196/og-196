import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Coins as CoinsIcon, Crown, Loader2, Search, ShieldOff, ShieldCheck, Globe, Check, X as XIcon, Pencil } from "lucide-react";
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
  token: { revoked_at: string | null; last_used_at: string | null; expires_at: string | null } | null;
  interactions: number;
}

export function WidgetAccessAudit() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const dataQ = useQuery({
    queryKey: ["admin-widget-audit"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: profs, error: e1 }, { data: roles, error: e2 }, { data: tokens, error: e3 }, { data: txs, error: e4 }] =
        await Promise.all([
          supabase.from("profiles").select("id, email, display_name, coin_balance").order("email").limit(500),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("og_bot_tokens").select("user_id, revoked_at, last_used_at, expires_at"),
          supabase.from("coin_transactions").select("user_id, type").in("type", ["generation", "og_bot_token_rotate", "og_bot_invite_redeem"]),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;

      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      const tokenByUser = new Map<string, Row["token"]>();
      (tokens ?? []).forEach((t: any) => tokenByUser.set(t.user_id, {
        revoked_at: t.revoked_at, last_used_at: t.last_used_at, expires_at: t.expires_at,
      }));
      const txByUser = new Map<string, number>();
      (txs ?? []).forEach((t: any) => txByUser.set(t.user_id, (txByUser.get(t.user_id) ?? 0) + 1));

      return (profs ?? []).map((p: any) => ({
        id: p.id, email: p.email, display_name: p.display_name, coin_balance: p.coin_balance,
        roles: rolesByUser.get(p.id) ?? [],
        token: tokenByUser.get(p.id) ?? null,
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

  const toggleAccess = useMutation({
    mutationFn: async ({ userId, revoke }: { userId: string; revoke: boolean }) => {
      const fn = revoke ? "revoke_og_bot_token" : "unrevoke_og_bot_token";
      const { error } = await supabase.rpc(fn, {
        target_user_id: userId, admin_notes: "widget_audit_toggle",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-widget-audit"] });
      toast.success(vars.revoke ? "Widget access revoked" : "Widget access restored");
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
          <h3 className="font-semibold">Widget Deployment & Access Audit</h3>
          <p className="text-xs text-muted-foreground">
            Every user with the OG Bot embed: account tier, embed status, interactions, and access controls.
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
                <TableHead>Widget</TableHead>
                <TableHead className="text-right">Interactions</TableHead>
                <TableHead className="text-right">Coins</TableHead>
                <TableHead className="text-center">VIP</TableHead>
                <TableHead className="text-right">Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((r) => {
                const isVip = r.roles.includes("vip");
                const hasBot = r.roles.includes("og_bot") || !!r.token;
                const revoked = !!r.token?.revoked_at;
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
                    <TableCell>
                      {hasBot ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Globe className="h-3 w-3 text-emerald-400" />
                          <span className={cn(revoked ? "text-destructive" : "text-emerald-400")}>
                            {revoked ? "Revoked" : "Embedded"}
                          </span>
                          {r.token?.last_used_at && (
                            <span className="text-muted-foreground">
                              · {new Date(r.token.last_used_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not deployed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{r.interactions}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{r.coin_balance}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={isVip}
                        disabled={toggleVip.isPending}
                        onCheckedChange={(v) => toggleVip.mutate({ userId: r.id, makeVip: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {hasBot ? (
                        <Button
                          size="sm"
                          variant={revoked ? "outline" : "destructive"}
                          disabled={toggleAccess.isPending}
                          onClick={() => toggleAccess.mutate({ userId: r.id, revoke: !revoked })}
                        >
                          {revoked ? (
                            <><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Restore</>
                          ) : (
                            <><ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Revoke</>
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
