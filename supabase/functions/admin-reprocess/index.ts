// Admin-only: re-runs Suno generation for a song without deducting coins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY")!;
const SUNO_API_URL = "https://apibox.erweima.ai/api/v1/generate";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { song_id } = await req.json();
    if (!song_id) return json({ error: "Missing song_id" }, 400);

    const { data: song, error } = await admin.from("songs").select("*").eq("id", song_id).single();
    if (error || !song) return json({ error: "Song not found" }, 404);

    await admin.from("songs").update({
      status: "processing", error_message: null, audio_path: null, completed_at: null,
    }).eq("id", song_id);

    const callbackUrl = `${SUPABASE_URL}/functions/v1/suno-callback?song_id=${song.id}`;
    const sunoRes = await fetch(SUNO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUNO_API_KEY}` },
      body: JSON.stringify({
        prompt: song.lyrics || song.prompt,
        style: song.style || undefined,
        title: song.title || undefined,
        customMode: !!(song.style || song.lyrics || song.title),
        instrumental: false,
        model: "V4",
        callBackUrl: callbackUrl,
      }),
    });
    const text = await sunoRes.text();
    if (!sunoRes.ok) {
      await admin.from("songs").update({ status: "failed", error_message: `Suno ${sunoRes.status}: ${text.slice(0, 200)}` }).eq("id", song_id);
      return json({ error: "Suno rejected", details: text.slice(0, 300) }, 502);
    }
    let body: any = {};
    try { body = JSON.parse(text); } catch {}
    const taskId = body?.data?.taskId ?? body?.taskId ?? null;
    await admin.from("songs").update({ suno_task_id: taskId }).eq("id", song_id);
    return json({ ok: true, task_id: taskId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}
