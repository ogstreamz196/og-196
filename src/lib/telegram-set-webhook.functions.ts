import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const DEFAULT_WEBHOOK_URL =
  "https://ogwidget.lovable.app/api/public/telegram/webhook";

export type SetWebhookResult = {
  ok: boolean;
  url: string;
  description: string;
  botUsername: string | null;
};

function deriveSecret(key: string): string {
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}

/**
 * Admin one-click: (re)point Telegram at our webhook endpoint with the
 * derived secret. Use when /start in Telegram gets no reply — usually means
 * the active bot token isn't registered against our URL anymore.
 */
export const setTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: unknown): { url?: string } => {
      const d = (data ?? {}) as { url?: unknown };
      return { url: typeof d.url === "string" && d.url.length ? d.url : undefined };
    },
  )
  .handler(async ({ context, data }): Promise<SetWebhookResult> => {
    const supabase = context.supabase as unknown as {
      rpc: (
        fn: "has_role",
        args: { _user_id: string; _role: "admin" },
      ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
    };
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const lovableKey = process.env.LOVABLE_API_KEY;
    const tgKey = process.env.TELEGRAM_API_KEY;
    if (!lovableKey || !tgKey) {
      throw new Error("Telegram connector not configured");
    }
    const url = data.url ?? DEFAULT_WEBHOOK_URL;
    const secret = deriveSecret(tgKey);

    const setRes = await fetch(`${GATEWAY_URL}/setWebhook`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": tgKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        secret_token: secret,
        drop_pending_updates: true,
        allowed_updates: ["message", "edited_message"],
      }),
    });
    const setJson = (await setRes.json().catch(() => null)) as
      | { ok?: boolean; description?: string }
      | null;
    if (!setRes.ok || setJson?.ok !== true) {
      throw new Error(setJson?.description ?? `setWebhook HTTP ${setRes.status}`);
    }

    // Identify the bot the token actually belongs to.
    let botUsername: string | null = null;
    try {
      const meRes = await fetch(`${GATEWAY_URL}/getMe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": tgKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const meJson = (await meRes.json().catch(() => null)) as
        | { ok?: boolean; result?: { username?: string } }
        | null;
      botUsername = meJson?.result?.username ?? null;
    } catch {
      botUsername = null;
    }

    return {
      ok: true,
      url,
      description: setJson?.description ?? "Webhook set",
      botUsername,
    };
  });
