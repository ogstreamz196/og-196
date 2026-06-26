import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const supabase = context.supabase as {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  };
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type CoinDiscrepancy = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  balance: number;
  ledgerSum: number;
  delta: number;
  txCount: number;
};

export type CoinAuditResult =
  | { ok: true; checked: number; discrepancies: CoinDiscrepancy[]; scope: "all" | "user" }
  | { error: string };

export const auditCoinBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId?: string }) => data)
  .handler(async ({ data, context }): Promise<CoinAuditResult> => {
    try {
      await assertAdmin(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const profileQuery = supabaseAdmin
        .from("profiles")
        .select("id,email,display_name,coin_balance");
      const { data: profiles, error: pErr } = data.userId
        ? await profileQuery.eq("id", data.userId)
        : await profileQuery.limit(2000);
      if (pErr) return { error: pErr.message };

      const ids = (profiles ?? []).map((p: any) => p.id as string);
      if (ids.length === 0) {
        return { ok: true, checked: 0, discrepancies: [], scope: data.userId ? "user" : "all" };
      }

      const { data: txs, error: tErr } = await supabaseAdmin
        .from("coin_transactions")
        .select("user_id,amount")
        .in("user_id", ids);
      if (tErr) return { error: tErr.message };

      const sums = new Map<string, { sum: number; count: number }>();
      for (const t of (txs ?? []) as Array<{ user_id: string; amount: number }>) {
        const cur = sums.get(t.user_id) ?? { sum: 0, count: 0 };
        cur.sum += Number(t.amount) || 0;
        cur.count += 1;
        sums.set(t.user_id, cur);
      }

      const discrepancies: CoinDiscrepancy[] = [];
      for (const p of profiles as Array<any>) {
        const agg = sums.get(p.id) ?? { sum: 0, count: 0 };
        const balance = Number(p.coin_balance) || 0;
        const delta = balance - agg.sum;
        if (delta !== 0) {
          discrepancies.push({
            user_id: p.id,
            email: p.email ?? null,
            display_name: p.display_name ?? null,
            balance,
            ledgerSum: agg.sum,
            delta,
            txCount: agg.count,
          });
        }
      }

      discrepancies.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      return {
        ok: true,
        checked: ids.length,
        discrepancies,
        scope: data.userId ? "user" : "all",
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Audit failed" };
    }
  });

export type ReconcileResult =
  | { ok: true; user_id: string; previous: number; corrected: number; delta: number }
  | { error: string };

export const reconcileUserCoinBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }): Promise<ReconcileResult> => {
    try {
      await assertAdmin(context);
      if (!data.userId) return { error: "userId required" };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("coin_balance")
        .eq("id", data.userId)
        .maybeSingle();
      if (pErr) return { error: pErr.message };
      if (!profile) return { error: "User not found" };

      const { data: txs, error: tErr } = await supabaseAdmin
        .from("coin_transactions")
        .select("amount")
        .eq("user_id", data.userId);
      if (tErr) return { error: tErr.message };

      const ledger = (txs ?? []).reduce(
        (acc: number, t: any) => acc + (Number(t.amount) || 0),
        0,
      );
      const prev = Number(profile.coin_balance) || 0;
      const delta = ledger - prev;
      if (delta === 0) {
        return { ok: true, user_id: data.userId, previous: prev, corrected: prev, delta: 0 };
      }
      const { error: rpcErr } = await supabaseAdmin.rpc("increment_coin_balance", {
        _user_id: data.userId,
        _delta: delta,
      });
      if (rpcErr) return { error: rpcErr.message };

      await supabaseAdmin.from("coin_transactions").insert({
        user_id: data.userId,
        amount: delta,
        type: "admin_reconcile",
        reference: `reconcile:${Date.now()}`,
      });

      return { ok: true, user_id: data.userId, previous: prev, corrected: ledger, delta };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Reconcile failed" };
    }
  });
