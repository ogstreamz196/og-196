import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertBoss(ctx: { supabase: any; userId: string }) {
  const [b, a] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "boss" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
  ]);
  if (!b.data && !a.data) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getLedgerlySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertBoss(context);
    const { data } = await db.from("ledgerly_settings").select("*").eq("id", 1).maybeSingle();
    const key = data?.api_key ?? "";
    return {
      enabled: !!data?.enabled,
      hasKey: !!key,
      keyHint: key ? `${key.slice(0, 8)}…${key.slice(-4)}` : null,
      lastTestOk: data?.last_test_ok ?? null,
      lastTestAt: data?.last_test_at ?? null,
      lastError: data?.last_error ?? null,
    };
  });

export const saveLedgerlySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean; apiKey?: string }) => {
    if (d.apiKey && (d.apiKey.length > 300 || !/^\S+$/.test(d.apiKey))) throw new Error("Invalid key");
    return { enabled: !!d.enabled, apiKey: d.apiKey?.trim() || undefined };
  })
  .handler(async ({ data, context }) => {
    const db = await assertBoss(context);
    const patch: Record<string, unknown> = { enabled: data.enabled, updated_at: new Date().toISOString() };
    if (data.apiKey) Object.assign(patch, { api_key: data.apiKey, last_test_ok: null, last_error: null });
    const { error } = await db.from("ledgerly_settings").update(patch as never).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testLedgerlyConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertBoss(context);
    const { data } = await db.from("ledgerly_settings").select("api_key").eq("id", 1).maybeSingle();
    if (!data?.api_key) return { ok: false, message: "Save an API key first" };
    const { postLedgerly } = await import("./ledgerly.server");
    let ok = false;
    let message = "";
    try {
      const r = await postLedgerly(data.api_key, {
        amount: 0,
        description: "OG BOT connection test",
        reference: "connection-test",
        externalId: "ogbot-connection-test",
      });
      ok = r.ok;
      message = r.ok ? "Connected" : `HTTP ${r.status}: ${r.body || "rejected"}`;
    } catch (e) {
      message = e instanceof Error ? e.message : "Network error";
    }
    await db
      .from("ledgerly_settings")
      .update({ last_test_ok: ok, last_test_at: new Date().toISOString(), last_error: ok ? null : message })
      .eq("id", 1);
    return { ok, message };
  });
