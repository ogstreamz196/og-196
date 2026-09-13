import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * OG VIP PASS — a Boss-managed pool of reusable username/password logins.
 * A buyer is shown one random pass from the pool; the same login can be
 * shared by many members, and the Boss can rotate/edit the pool anytime.
 * Credentials are readable only through these trusted server functions.
 */

export const VIP_PASS_SLUG = "og-vip-pass";

export type VipPassStatus = {
  owned: boolean;
  username: string | null;
  password: string | null;
  /** Passes in the pool — used to show "sold out". */
  available: number;
};

export type VipPassCredential = {
  id: string;
  username: string;
  password: string;
  note: string | null;
  active: boolean;
  claims: number;
  created_at: string;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

// ─── user: my pass ────────────────────────────────────────────────────────
export const getVipPassStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VipPassStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [mine, pool] = await Promise.all([
      supabaseAdmin
        .from("vip_pass_purchases")
        .select("credential_id, vip_pass_credentials(username, password)")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("vip_pass_credentials")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
    ]);
    if (mine.error) throw new Error(mine.error.message);
    const cred = (mine.data as any)?.vip_pass_credentials ?? null;
    return {
      owned: !!mine.data,
      username: cred?.username ?? null,
      password: cred?.password ?? null,
      available: pool.count ?? 0,
    };
  });

export const purchaseVipPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("purchase_vip_pass_for_user", {
      p_user: context.userId,
    });
    if (error) throw new Error(error.message);
    return data as {
      ok: boolean;
      already_owned: boolean;
      username: string;
      password: string;
    };
  });

// ─── boss: manage the pool ────────────────────────────────────────────────
export const listVipPassCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VipPassCredential[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vip_pass_credentials")
      .select("id, username, password, note, active, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const counts = new Map<string, number>();
    if (rows.length > 0) {
      const { data: purchases } = await supabaseAdmin
        .from("vip_pass_purchases")
        .select("credential_id");
      for (const p of purchases ?? []) {
        counts.set(p.credential_id, (counts.get(p.credential_id) ?? 0) + 1);
      }
    }
    return rows.map((r) => ({ ...r, claims: counts.get(r.id) ?? 0 })) as VipPassCredential[];
  });

/** Bulk add: one `username:password` (or `username,password` / space) per line. */
export const addVipPassCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string }) => {
    if (typeof data?.text !== "string" || !data.text.trim()) throw new Error("Paste at least one line");
    if (data.text.length > 100_000) throw new Error("Too much text at once");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const rows: Array<{ username: string; password: string; created_by: string }> = [];
    const skipped: string[] = [];
    for (const raw of data.text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/[:,|\t ]+/).filter(Boolean);
      if (parts.length < 2) {
        skipped.push(line);
        continue;
      }
      rows.push({ username: parts[0]!, password: parts[1]!, created_by: context.userId });
    }
    if (rows.length === 0) throw new Error("No valid username / password pairs found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let added = 0;
    const duplicates: string[] = [];
    for (const row of rows) {
      const { error } = await supabaseAdmin.from("vip_pass_credentials").insert(row);
      if (error) duplicates.push(row.username);
      else added += 1;
    }
    return { added, duplicates, skipped };
  });

/** Edit a login (rotate username/password) or enable/disable it. */
export const updateVipPassCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; active?: boolean; note?: string | null; username?: string; password?: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(d.id)) throw new Error("Invalid id");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { active?: boolean; note?: string | null; username?: string; password?: string } = {};
    if (typeof data.active === "boolean") patch.active = data.active;
    if (data.note !== undefined) patch.note = data.note;
    if (typeof data.username === "string" && data.username.trim()) patch.username = data.username.trim();
    if (typeof data.password === "string" && data.password.trim()) patch.password = data.password.trim();
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("vip_pass_credentials")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete only while nobody has been given this login. */
export const deleteVipPassCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(d.id)) throw new Error("Invalid id");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("vip_pass_purchases")
      .select("id", { count: "exact", head: true })
      .eq("credential_id", data.id);
    if ((count ?? 0) > 0) throw new Error("Members already have this login — disable it instead");
    const { error } = await supabaseAdmin
      .from("vip_pass_credentials")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
