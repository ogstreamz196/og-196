// Admin-only: re-runs Suno generation for a song without deducting coins.
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin-guard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY")!;
const SUNO_API_URL = "https://apibox.erweima.ai/api/v1/generate";

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  try {
    const guard = await requireAdmin(req);
    if (guard.error) return guard.error;
    const { admin } = guard;

    const { song_id } = await req.json();
    if (!song_id) return jsonResponse({ error: "Missing song_id" }, 400);

    const { data: song, error } = await admin.from("songs").select("*").eq("id", song_id).single();
    if (error || !song) return jsonResponse({ error: "Song not found" }, 404);
    const s = song as Record<string, unknown>;

    await admin.from("songs").update({
      status: "processing", error_message: null, audio_path: null, completed_at: null,
    }).eq("id", song_id);

    const callbackUrl = `${SUPABASE_URL}/functions/v1/suno-callback?song_id=${s.id}`;
    const sunoRes = await fetch(SUNO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUNO_API_KEY}` },
      body: JSON.stringify({
        prompt: s.lyrics || s.prompt,
        style: s.style || undefined,
        title: s.title || undefined,
        customMode: !!(s.style || s.lyrics || s.title),
        instrumental: false,
        model: "V4",
        callBackUrl: callbackUrl,
      }),
    });
    const text = await sunoRes.text();
    if (!sunoRes.ok) {
      await admin.from("songs").update({ status: "failed", error_message: `Suno ${sunoRes.status}: ${text.slice(0, 200)}` }).eq("id", song_id);
      return jsonResponse({ error: "Suno rejected", details: text.slice(0, 300) }, 502);
    }
    let body: { data?: { taskId?: string }; taskId?: string } = {};
    try { body = JSON.parse(text); } catch { /* ignore */ }
    const taskId = body?.data?.taskId ?? body?.taskId ?? null;
    await admin.from("songs").update({ suno_task_id: taskId }).eq("id", song_id);
    return jsonResponse({ ok: true, task_id: taskId });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
