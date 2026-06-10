// Public webhook for Suno completion callbacks.
// Suno returns 1-2 clips per task. We fan them out into individual song rows:
// the first clip updates the original pending row, additional clips create sibling rows
// owned by the same user and tagged with the same suno_task_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allow-list of hostnames we'll fetch audio from (defence-in-depth SSRF guard).
const AUDIO_HOST_ALLOWLIST = [
  "apibox.erweima.ai",
  "cdn1.suno.ai",
  "cdn2.suno.ai",
  "audiopipe.suno.ai",
  "mfile.erweima.ai",
  "sunoapi.org",
];

function hostAllowed(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return AUDIO_HOST_ALLOWLIST.some((d) => h === d || h.endsWith("." + d));
  } catch { return false; }
}

async function expectedToken(songId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SERVICE_ROLE),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(songId));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const songId = url.searchParams.get("song_id");
  const token = url.searchParams.get("token") ?? "";
  if (!songId) return new Response("Missing song_id", { status: 400 });

  const expected = await expectedToken(songId);
  if (!timingSafeEq(token, expected)) {
    console.warn("Suno callback rejected: bad token for", songId);
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { /* tolerate empty */ }
  console.log("Suno callback for", songId, JSON.stringify(payload).slice(0, 800));

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: parentSong } = await admin.from("songs").select("*").eq("id", songId).single();
  if (!parentSong) return new Response("Song not found", { status: 404 });

  // Failure callback
  const callbackType = payload?.data?.callbackType || payload?.callbackType;
  if (callbackType === "error" || (payload?.code && payload.code !== 200)) {
    // Guard against double-refund: only refund when song still pending/processing.
    if (parentSong.status === "completed" || parentSong.status === "failed") {
      console.log("Skipping refund — song already terminal:", parentSong.status);
      return new Response("ok", { status: 200 });
    }
    // Refund using portal override when applicable; fall back to global setting.
    let refundAmt = 3;
    if (parentSong.portal_id) {
      const { data: portal } = await admin
        .from("portals").select("coin_cost_per_generation").eq("id", parentSong.portal_id).maybeSingle();
      if (typeof portal?.coin_cost_per_generation === "number") refundAmt = portal.coin_cost_per_generation;
    } else {
      const { data: setting } = await admin
        .from("app_settings").select("value").eq("key", "coins_per_generation").maybeSingle();
      if (typeof setting?.value === "number") refundAmt = setting.value;
    }
    await admin.from("songs").update({
      status: "failed",
      error_message: payload?.msg || payload?.message || "Suno reported failure",
    }).eq("id", songId);
    await admin.from("coin_transactions").insert({
      user_id: parentSong.user_id, amount: refundAmt, type: "refund", reference: songId,
    });
    const { data: prof } = await admin.from("profiles").select("coin_balance").eq("id", parentSong.user_id).single();
    await admin.from("profiles").update({ coin_balance: (prof?.coin_balance ?? 0) + refundAmt }).eq("id", parentSong.user_id);
    return new Response("ok", { status: 200 });
  }

  // Collect clip items (cover common gateway shapes)
  const rawItems =
    payload?.data?.data ||
    payload?.data ||
    (Array.isArray(payload) ? payload : null) ||
    (payload?.clip ? [payload.clip] : null) ||
    [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  const clips = items
    .map((c: any) => ({
      audioUrl: c?.audio_url || c?.audioUrl || c?.source_audio_url,
      coverUrl: c?.image_url || c?.imageUrl || c?.cover_url,
      title: c?.title,
      duration: c?.duration,
      clipId: c?.id || c?.clip_id,
    }))
    .filter((c) => !!c.audioUrl && hostAllowed(c.audioUrl));

  if (clips.length === 0) {
    console.log("No audio clips ready yet (or all rejected by host allow-list)");
    return new Response("waiting", { status: 200 });
  }

  try {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];

      // Skip if we've already stored this clip
      if (clip.clipId) {
        const { data: existing } = await admin
          .from("songs").select("id").eq("suno_clip_id", clip.clipId).maybeSingle();
        if (existing) continue;
      }

      const audioRes = await fetch(clip.audioUrl!);
      if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
      const audioBuf = new Uint8Array(await audioRes.arrayBuffer());

      let targetId = i === 0 ? songId : null;
      if (!targetId) {
        // Insert sibling row for additional clip
        const { data: sib, error: sibErr } = await admin.from("songs").insert({
          user_id: parentSong.user_id,
          prompt: parentSong.prompt,
          style: parentSong.style,
          lyrics: parentSong.lyrics,
          title: clip.title ?? parentSong.title,
          status: "processing",
          suno_task_id: parentSong.suno_task_id,
          portal_id: parentSong.portal_id ?? null,
        }).select("id").single();
        if (sibErr) throw sibErr;
        targetId = sib.id;
      }

      const path = `${parentSong.user_id}/${targetId}.mp3`;
      const { error: uploadErr } = await admin.storage.from("song-files").upload(path, audioBuf, {
        contentType: "audio/mpeg", upsert: true,
      });
      if (uploadErr) throw uploadErr;

      await admin.from("songs").update({
        status: "completed",
        audio_path: path,
        cover_url: clip.coverUrl ?? null,
        title: clip.title ?? parentSong.title,
        suno_clip_id: clip.clipId ?? null,
        duration_seconds: clip.duration ?? null,
        completed_at: new Date().toISOString(),
      }).eq("id", targetId);
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("Audio processing failed", e);
    await admin.from("songs").update({
      status: "failed",
      error_message: `Audio processing failed: ${(e as Error).message}`,
    }).eq("id", songId);
    return new Response("error", { status: 500 });
  }
});
