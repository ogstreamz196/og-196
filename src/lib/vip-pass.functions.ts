import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * OG VIP PASS — a Boss-managed pool of username/password logins.
 * A buyer is permanently assigned one random unused pass from the pool.
 * Credentials are readable only through these trusted server functions.
 */

export const VIP_PASS_SLUG = "og-vip-pass";

export type VipPassStatus = {
  owned: boolean;
  username: string | null;
  password: string | null;
  /** Passes still available in the pool — used to show "sold out". */
  available: number;
};

export type VipPassCredential = {
  id: string;
  username: string;
  password: string;
  note: string | null;
  active: boolean;
  assigned_user_id: string | null;
  assigned_at: string | null;
  assigned_email: string | null;
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
        .from("vip_pass_credentials")
        .select("username, password")
        .eq("assigned_user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("vip_pass_credentials")
        .select("id", { count: "exact", head: true })
        .is("assigned_user_id", null)
        .eq("active", true),
    ]);
    if (mine.error) throw new Error(mine.error.message);
    return {
      owned: !!mine.data,
      username: mine.data?.username ?? null,
      password: mine.data?.password ?? null,
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
      .select("id, username, password, note, active, assigned_user_id, assigned_at, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const userIds = [...new Set(rows.map((r) => r.assigned_user_id).filter(Boolean))] as string[];
    const emails = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        emails.set(p.id as string, (p.email as string) ?? (p.display_name as string) ?? "");
      }
    }
    return rows.map((r) => ({
      ...r,
      assigned_email: r.assigned_user_id ? emails.get(r.assigned_user_id) ?? null : null,
    })) as VipPassCredential[];
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

export const updateVipPassCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; active?: boolean; note?: string | null }) => {
    if (!/^[0-9a-f-]{36}$/i.test(d.id)) throw new Error("Invalid id");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { active?: boolean; note?: string | null } = {};
    if (typeof data.active === "boolean") patch.active = data.active;
    if (data.note !== undefined) patch.note = data.note;
    const { error } = await supabaseAdmin
      .from("vip_pass_credentials")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVipPassCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(d.id)) throw new Error("Invalid id");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("vip_pass_credentials")
      .delete()
      .eq("id", data.id)
      .is("assigned_user_id", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
