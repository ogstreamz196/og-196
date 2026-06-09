// Public webhook for Suno completion callbacks.
// Suno (or your gateway) POSTs to this URL with audio info when generation finishes.
// We download the mp3, store it in the private 'song-files' bucket, and mark the song completed.
// Adjust payload parsing for your specific Suno API provider.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const songId = url.searchParams.get("song_id");
  if (!songId) return new Response("Missing song_id", { status: 400 });

  let payload: any = {};
  try { payload = await req.json(); } catch { /* tolerate empty */ }
  console.log("Suno callback received for", songId, JSON.stringify(payload).slice(0, 500));

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Look up song to confirm and get user_id
  const { data: song } = await admin.from("songs").select("*").eq("id", songId).single();
  if (!song) return new Response("Song not found", { status: 404 });

  // Extract clip info — covers a few common Suno gateway payload shapes
  const items =
    payload?.data?.data ||
    payload?.data ||
    (Array.isArray(payload) ? payload : null) ||
    (payload?.clip ? [payload.clip] : null) ||
    [];

  const clip = Array.isArray(items) ? items[0] : items;
  const audioUrl: string | undefined = clip?.audio_url || clip?.audioUrl || clip?.source_audio_url;
  const coverUrl: string | undefined = clip?.image_url || clip?.imageUrl || clip?.cover_url;
  const title: string | undefined = clip?.title;
  const duration: number | undefined = clip?.duration;
  const clipId: string | undefined = clip?.id || clip?.clip_id;

  // Handle failure callbacks
  const callbackType = payload?.data?.callbackType || payload?.callbackType;
  if (callbackType === "error" || payload?.code && payload.code !== 200) {
    await admin.from("songs").update({
      status: "failed",
      error_message: payload?.msg || payload?.message || "Suno reported failure",
    }).eq("id", songId);
    // Refund coins
    await admin.from("coin_transactions").insert({
      user_id: song.user_id, amount: 3, type: "refund", reference: songId,
    });
    const { data: prof } = await admin.from("profiles").select("coin_balance").eq("id", song.user_id).single();
    await admin.from("profiles").update({ coin_balance: (prof?.coin_balance ?? 0) + 3 }).eq("id", song.user_id);
    return new Response("ok", { status: 200 });
  }

  if (!audioUrl) {
    // Probably a 'text' or 'first' partial callback. Wait for the complete one.
    console.log("No audio_url yet — likely intermediate callback");
    return new Response("waiting", { status: 200 });
  }

  // Download the audio file
  try {
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
    const audioBuf = new Uint8Array(await audioRes.arrayBuffer());
    const path = `${song.user_id}/${songId}.mp3`;

    const { error: uploadErr } = await admin.storage.from("song-files").upload(path, audioBuf, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (uploadErr) throw uploadErr;

    await admin.from("songs").update({
      status: "completed",
      audio_path: path,
      cover_url: coverUrl ?? null,
      title: title ?? song.title,
      suno_clip_id: clipId ?? null,
      duration_seconds: duration ?? null,
      completed_at: new Date().toISOString(),
    }).eq("id", songId);

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
