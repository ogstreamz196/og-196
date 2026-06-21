import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

/**
 * Admin-only: DM a user via OG Bot on Telegram.
 * Requires the user to have linked their Telegram (profile.telegram_chat_id set
 * by the /api/public/telegram/webhook handler when they hit /start <token>).
 */
export const sendTelegramDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; text: string }) => {
    if (!data?.userId) throw new Error("userId required");
    const text = (data.text ?? "").trim();
    if (!text) throw new Error("Message is empty");
    if (text.length > 4000) throw new Error("Message too long (max 4000)");
    return { userId: data.userId, text };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("telegram_chat_id, display_name, email")
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.telegram_chat_id) throw new Error("User hasn't linked Telegram yet");

    const lovableKey = process.env.LOVABLE_API_KEY;
    const tgKey = process.env.TELEGRAM_API_KEY;
    if (!lovableKey || !tgKey) throw new Error("Telegram connector not configured");

    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": tgKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: row.telegram_chat_id,
        text: data.text,
        parse_mode: "HTML",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok === false) {
      throw new Error(`Telegram error [${res.status}]: ${body?.description ?? "send failed"}`);
    }
    return { ok: true as const, message_id: body?.result?.message_id ?? null };
  });
