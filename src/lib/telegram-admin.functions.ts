import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

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

async function sendViaGateway(chatId: number, text: string) {
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
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok === false) {
    throw new Error(
      `Telegram error [${res.status}]: ${body?.description ?? "send failed"}`,
    );
  }
  return body?.result?.message_id as number | undefined;
}

/** Admin: queue a DM, attempt to send, and persist sent/failed status. */
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
    await assertAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Queue a row first so even failures are visible / retryable.
    const { data: queued, error: insErr } = await supabaseAdmin
      .from("telegram_dm_queue")
      .insert({
        target_user_id: data.userId,
        sent_by: context.userId,
        body: data.text,
        status: "pending",
        attempts: 0,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    if (!row?.telegram_chat_id) {
      await supabaseAdmin
        .from("telegram_dm_queue")
        .update({
          status: "failed",
          attempts: 1,
          last_error: "User hasn't linked Telegram yet",
        })
        .eq("id", queued.id);
      throw new Error("User hasn't linked Telegram yet");
    }

    try {
      const messageId = await sendViaGateway(row.telegram_chat_id, data.text);
      await supabaseAdmin
        .from("telegram_dm_queue")
        .update({
          status: "sent",
          attempts: 1,
          sent_at: new Date().toISOString(),
          telegram_message_id: messageId ?? null,
          last_error: null,
        })
        .eq("id", queued.id);
      return { ok: true as const, message_id: messageId ?? null, queueId: queued.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : "send failed";
      await supabaseAdmin
        .from("telegram_dm_queue")
        .update({ status: "failed", attempts: 1, last_error: message })
        .eq("id", queued.id);
      throw new Error(message);
    }
  });

/** Admin: retry a previously-failed queued message. */
export const retryTelegramDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { queueId: string }) => {
    if (!data?.queueId) throw new Error("queueId required");
    return { queueId: data.queueId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: queue, error } = await supabaseAdmin
      .from("telegram_dm_queue")
      .select("id, target_user_id, body, status, attempts")
      .eq("id", data.queueId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!queue) throw new Error("Queue item not found");
    if (queue.status === "sent") return { ok: true as const, alreadySent: true };

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", queue.target_user_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    const attempts = (queue.attempts ?? 0) + 1;

    if (!profile?.telegram_chat_id) {
      await supabaseAdmin
        .from("telegram_dm_queue")
        .update({
          status: "failed",
          attempts,
          last_error: "User hasn't linked Telegram yet",
        })
        .eq("id", queue.id);
      throw new Error("User hasn't linked Telegram yet");
    }

    try {
      const messageId = await sendViaGateway(profile.telegram_chat_id, queue.body);
      await supabaseAdmin
        .from("telegram_dm_queue")
        .update({
          status: "sent",
          attempts,
          sent_at: new Date().toISOString(),
          telegram_message_id: messageId ?? null,
          last_error: null,
        })
        .eq("id", queue.id);
      return { ok: true as const, message_id: messageId ?? null };
    } catch (e) {
      const message = e instanceof Error ? e.message : "send failed";
      await supabaseAdmin
        .from("telegram_dm_queue")
        .update({ status: "failed", attempts, last_error: message })
        .eq("id", queue.id);
      throw new Error(message);
    }
  });

export type TelegramQueueRow = {
  id: string;
  body: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

/** Admin: list queued + recent DM attempts for a user. */
export const listTelegramDmsForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    if (!data?.userId) throw new Error("userId required");
    return { userId: data.userId };
  })
  .handler(async ({ data, context }): Promise<TelegramQueueRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("telegram_dm_queue")
      .select("id, body, status, attempts, last_error, sent_at, created_at")
      .eq("target_user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return (rows ?? []) as TelegramQueueRow[];
  });
