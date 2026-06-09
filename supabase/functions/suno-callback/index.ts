// Public webhook for Suno completion callbacks.
// Suno returns 1-2 clips per task. We fan them out into individual song rows:
// the first clip updates the original pending row, additional clips create sibling rows
// owned by the same user and tagged with the same suno_task_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const songId = url.searchParams.get("song_id");
  if (!songId) return new Response("Missing song_id", { status: 400 });

  let payload: any = {};
  try { payload = await req.json(); } catch { /* tolerate empty */ }
  console.log("Suno callback for", songId, JSON.stringify(payload).slice(0, 800));

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: parentSong } = await admin.from("songs").select("*").eq("id", songId).single();
  if (!parentSong) return new Response("Song not found", { status: 404 });

  // Failure callback
  const callbackType = payload?.data?.callbackType || payload?.callbackType;
  if (callbackType === "error" || (payload?.code && payload.code !== 200)) {
    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "coins_per_generation").maybeSingle();
    const refundAmt = typeof setting?.value === "number" ? setting.value : 3;
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
    .filter((c) => !!c.audioUrl);

  if (clips.length === 0) {
    console.log("No audio clips ready yet — intermediate callback");
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
