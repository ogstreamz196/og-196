import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Finishes songs whose phone dropped off mid-creation: writes the lyrics and
 * hands them to the music engine on the server, using the exact saved answers.
 */
export async function resumeOrphanedSongs(retryToken: string): Promise<number> {
  const backendUrl = process.env["SUPABASE_URL"];
  const anon = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!backendUrl || !anon) return 0;
  const db = supabaseAdmin as any;
  const { data, error } = await db.rpc("claim_due_orchestrations", { p_limit: 2 });
  if (error) throw new Error(error.message);
  let resumed = 0;
  for (const song of (data ?? []) as Array<Record<string, any>>) {
    const plan = (song.orchestration ?? {}) as { lyrics?: Record<string, unknown>; suno?: Record<string, unknown> };
    const headers = {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "x-ogbot-retry-token": retryToken,
      "x-og-user-id": String(song.user_id),
    };
    try {
      let lyrics = typeof song.lyrics === "string" && song.lyrics.trim() ? song.lyrics : "";
      if (!lyrics) {
        const r = await fetch(`${backendUrl}/functions/v1/generate-lyrics`, {
          method: "POST",
          headers,
          body: JSON.stringify({ ...(plan.lyrics ?? {}), song_id: song.id }),
          signal: AbortSignal.timeout(150_000),
        });
        const body = (await r.json().catch(() => ({}))) as { lyrics?: string };
        if (!r.ok || !body.lyrics) throw new Error(`lyrics ${r.status}`);
        lyrics = body.lyrics;
        await db.from("songs").update({ lyrics }).eq("id", song.id);
      }
      const g = await fetch(`${backendUrl}/functions/v1/suno-generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...(plan.suno ?? {}), song_id: song.id, lyrics }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!g.ok && g.status !== 409) throw new Error(`music ${g.status}`);
      await db.from("songs").update({ orchestration: null, error_message: null }).eq("id", song.id);
      resumed++;
    } catch (e) {
      console.error("Background song resume failed", song.id, (e as Error).message);
      await db
        .from("songs")
        .update({ orchestration_due_at: new Date(Date.now() + 5 * 60_000).toISOString() })
        .eq("id", song.id);
    }
  }
  return resumed;
}

/** Songs stuck "cooking" with no scheduled check get queued for recovery. */
export async function queueStuckSongs(): Promise<void> {
  const db = supabaseAdmin as any;
  const cutoff = new Date(Date.now() - 12 * 60_000).toISOString();
  await db
    .from("songs")
    .update({ next_retry_at: new Date().toISOString(), failure_class: "retryable" })
    .in("status", ["processing", "pending"])
    .is("next_retry_at", null)
    .lt("generation_started_at", cutoff)
    .gt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .lt("retry_count", 5);
}

const FRIENDLY: Record<number, string> = {
  400: "rejected the request",
  401: "key is invalid",
  402: "is out of credit",
  403: "access is blocked",
  429: "hit its quota / rate limit",
};

/** Quiet Telegram heads-up to Boss when an AI key keeps failing (max once/hour per key). */
export async function alertKeyFailures(): Promise<number> {
  const db = supabaseAdmin as any;
  const { data: rows } = await db
    .from("ai_key_failures")
    .select("id, key_name, status")
    .is("alerted_at", null)
    .limit(200);
  if (!rows?.length) return 0;
  const now = new Date().toISOString();
  await db.from("ai_key_failures").update({ alerted_at: now }).in("id", rows.map((r: any) => r.id));
  const { data: recent } = await db
    .from("ai_key_failures")
    .select("key_name")
    .gt("alerted_at", new Date(Date.now() - 3600_000).toISOString())
    .lt("alerted_at", now);
  const quiet = new Set((recent ?? []).map((r: any) => r.key_name));
  const byKey = new Map<string, { n: number; status: number }>();
  for (const r of rows) {
    if (quiet.has(r.key_name)) continue;
    const e = byKey.get(r.key_name) ?? { n: 0, status: r.status };
    e.n++;
    byKey.set(r.key_name, e);
  }
  // Only alert on repeat failures, not a single blip.
  const lines = [...byKey].filter(([, v]) => v.n >= 2).map(
    ([k, v]) => `• <b>${k}</b> ${FRIENDLY[v.status] ?? `failed (${v.status})`} — ${v.n}× recently`,
  );
  if (!lines.length) return 0;
  const { data: roleRows } = await db.from("user_roles").select("user_id").in("role", ["admin", "boss"]);
  const ids = [...new Set((roleRows ?? []).map((r: any) => r.user_id))];
  const { data: bosses } = await db.from("profiles").select("telegram_chat_id").in("id", ids);
  const chats = [...new Set((bosses ?? []).map((b: any) => b.telegram_chat_id).filter(Boolean))];
  const { vipAckTelegram } = await import("@/lib/vip-ack.server");
  const text = `⚠️ <b>AI key warning</b>\n${lines.join("\n")}\nSongs keep working on the other keys. Check Boss Controls → API & Integrations.`;
  await Promise.all(
    chats.map((chat_id) =>
      vipAckTelegram("sendMessage", { chat_id, text, parse_mode: "HTML", disable_notification: true }),
    ),
  );
  return lines.length;
}
