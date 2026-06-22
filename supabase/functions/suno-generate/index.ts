// Suno generation edge function.
// - Verifies the calling user
// - Reads dynamic pricing from app_settings (coins_per_generation)
// - Deducts coins atomically (refunds on Suno API failure)
// - Calls the Suno API; one task typically produces 2 clips
// - Inserts a 'pending' songs row; suno-callback fills it in + adds extra rows for sibling clips

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY")!;
const SUNO_API_URL = "https://apibox.erweima.ai/api/v1/generate";
const MAX_PROMPT_CHARS = 4_800;
const MAX_STYLE_CHARS = 900;
const MAX_TITLE_CHARS = 80;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getSetting(admin: any, key: string, fallback: number): Promise<number> {
  const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
  const v = data?.value;
  return typeof v === "number" ? v : fallback;
}

function limitText(value: string | null, max: number): string | null {
  if (!value) return value;
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const prompt = (body.prompt ?? "").toString().trim();
    const style = limitText((body.style ?? "").toString().trim() || null, MAX_STYLE_CHARS);
    const lyrics = limitText((body.lyrics ?? "").toString().trim() || null, MAX_PROMPT_CHARS);
    const title = limitText((body.title ?? "").toString().trim() || null, MAX_TITLE_CHARS);
    const instrumental = !!body.instrumental;
    const portalId = body.portal_id ? String(body.portal_id) : null;
    const existingSongId = body.song_id ? String(body.song_id) : null;

    if (!prompt && !lyrics) return json({ error: "Provide a prompt or lyrics" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    let coinCost = await getSetting(admin, "coins_per_generation", 3);

    // If this generation came from a portal, force the hardcoded language into the Suno prompt
    let portalLanguage: string | null = null;
    if (portalId) {
      const { data: p } = await admin
        .from("portals")
        .select("language, status, coin_cost_per_generation")
        .eq("id", portalId)
        .maybeSingle();
      if (!p) return json({ error: "Portal not found" }, 404);
      if (p.status === "maintenance") return json({ error: "Portal is in maintenance mode" }, 423);
      portalLanguage = p.language ?? null;
      if (typeof p.coin_cost_per_generation === "number") coinCost = p.coin_cost_per_generation;
    }
    const effectiveLyrics = lyrics && portalLanguage
      ? `[Language: ${portalLanguage}]\n${lyrics}`
      : lyrics;
    const effectivePrompt = !lyrics && portalLanguage
      ? `[Language: ${portalLanguage}] ${prompt}`
      : prompt;

    let song: { id: string } | null = null;
    const generationStartedAt = new Date().toISOString();
    if (existingSongId) {
      // Reuse the draft so the same song row progresses through the workflow stages.
      const { data: existing, error: exErr } = await admin
        .from("songs")
        .select("id, user_id")
        .eq("id", existingSongId)
        .maybeSingle();
      if (exErr) return json({ error: exErr.message }, 500);
      if (existing && existing.user_id !== user.id) {
        return json({ error: "Song not found" }, 404);
      }
      if (existing) {
        const { data: upd, error: updErr } = await admin
          .from("songs")
          .update({
            prompt: effectivePrompt,
            style,
            lyrics: effectiveLyrics,
            title,
            status: "pending",
            generation_started_at: generationStartedAt,
            portal_id: portalId,
            audio_path: null,
            sample_path: null,
            stream_audio_url: null,
            error_message: null,
          })
          .eq("id", existingSongId)
          .select("id")
          .single();
        if (updErr) return json({ error: updErr.message }, 500);
        song = upd;
      }
      // If existing is null (stale id from client), fall through to insert a fresh row.
    }
    if (!song) {

      const { data: inserted, error: songErr } = await admin
        .from("songs")
        .insert({ user_id: user.id, prompt: effectivePrompt, style, lyrics: effectiveLyrics, title, status: "pending", generation_started_at: generationStartedAt, portal_id: portalId })
        .select("id")
        .single();
      if (songErr) return json({ error: songErr.message }, 500);
      song = inserted;
    }
    const songId = song!.id;

    const { data: balance, error: deductErr } = await admin.rpc("deduct_coins", {
      p_user: user.id,
      p_amount: coinCost,
      p_reference: songId,
    });
    if (deductErr) {
      await admin.from("songs").update({ status: "failed", error_message: "Insufficient coins" }).eq("id", songId);
      return json({ error: "Insufficient coins", code: "insufficient_coins" }, 402);
    }

    const encoder = new TextEncoder();
    const hmacKey = await crypto.subtle.importKey(
      "raw", encoder.encode(SERVICE_ROLE),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(songId));
    const token = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const callbackUrl = `${SUPABASE_URL}/functions/v1/suno-callback?song_id=${songId}&token=${token}`;

    const customMode = !!(style || effectiveLyrics || title);
    const sunoTitle = limitText(title || "Untitled track", MAX_TITLE_CHARS);
    let sunoRes: Response;
    try {
      sunoRes = await fetch(SUNO_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUNO_API_KEY}` },
        body: JSON.stringify({
          prompt: effectiveLyrics || effectivePrompt,
          style: style || undefined,
          title: customMode ? sunoTitle : undefined,
          customMode,
          instrumental,
          model: "V4_5ALL",
          callBackUrl: callbackUrl,
        }),
      });
    } catch (e) {
      await refund(admin, user.id, songId, "Suno API unreachable", coinCost);
      return json({ error: "Suno API unreachable" }, 502);
    }

    const sunoText = await sunoRes.text();
    if (!sunoRes.ok) {
      console.error("Suno API error", sunoRes.status, sunoText);
      await refund(admin, user.id, songId, `Suno API ${sunoRes.status}: ${sunoText.slice(0, 200)}`, coinCost);
      return json({ error: "Suno API rejected the request", details: sunoText.slice(0, 300) }, 502);
    }

    let sunoBody: any = {};
    try { sunoBody = JSON.parse(sunoText); } catch { /* keep empty */ }
    if (typeof sunoBody?.code === "number" && sunoBody.code !== 200) {
      const reason = sunoBody?.msg || sunoBody?.message || `Suno API code ${sunoBody.code}`;
      console.error("Suno API rejected task", sunoBody.code, reason);
      await refund(admin, user.id, songId, reason, coinCost);
      return json({ error: reason, code: sunoBody.code }, sunoBody.code === 429 ? 402 : 502);
    }
    const taskId = sunoBody?.data?.taskId ?? sunoBody?.taskId ?? sunoBody?.task_id ?? null;
    if (!taskId) {
      const reason = sunoBody?.msg || sunoBody?.message || "Suno did not return a task ID";
      console.error("Suno missing task id", JSON.stringify(sunoBody).slice(0, 500));
      await refund(admin, user.id, songId, reason, coinCost);
      return json({ error: reason, code: "missing_task_id" }, 502);
    }

    await admin.from("songs").update({ status: "processing", suno_task_id: taskId }).eq("id", songId);

    return json({ song_id: songId, task_id: taskId, coin_balance: balance });
  } catch (e) {
    console.error("Unhandled error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function refund(admin: any, userId: string, songId: string, reason: string, amount: number) {
  await admin.from("songs").update({
    status: "failed",
    error_message: reason,
    suno_task_id: null,
  }).eq("id", songId);
  const { error } = await admin.rpc("refund_generation_charge", {
    p_user: userId,
    p_amount: amount,
    p_reference: songId,
  });
  if (error) console.error("Refund failed", error.message);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
