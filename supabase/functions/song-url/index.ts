// Issues a short-lived signed URL for the owner of a song to stream/download the audio file.
// Modes:
//   - "preview" (default): always allowed for the owner; client enforces sample-seconds cap.
//   - "full": only allowed when the song has been unlocked (e.g. paid / VIP grant).
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { adminClient, requireUser } from "../_shared/clients.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const song_id: string | undefined = body?.song_id;
  const mode: "preview" | "full" = body?.mode === "full" ? "full" : "preview";
  if (!song_id) return jsonResponse({ error: "Missing song_id" }, 400);

  const admin = adminClient();
  const { data: song } = await admin.from("songs")
    .select("user_id, audio_path, sample_path, status, unlocked")
    .eq("id", song_id).single();

  if (!song || song.user_id !== user.id) return jsonResponse({ error: "Not found" }, 404);

  if (mode === "full") {
    // Require an unlocked_songs record before ever returning the full URL.
    // songs.unlocked is a denormalised mirror; the unlock ledger is the source of truth.
    const { data: unlockRow } = await admin
      .from("unlocked_songs")
      .select("id")
      .eq("user_id", user.id)
      .eq("song_id", song_id)
      .maybeSingle();
    if (!unlockRow) return jsonResponse({ error: "Not unlocked", code: "locked" }, 403);
    if (!song.audio_path) return jsonResponse({ error: "Full track still downloading", code: "full_pending" }, 409);
  }

  // Preview ALWAYS serves the compressed sample. Full audio is never exposed
  // to the client unless the song has been explicitly unlocked.
  const path = mode === "full" ? song.audio_path! : song.sample_path;
  if (!path) {
    return jsonResponse({ error: mode === "full" ? "Not ready" : "Sample not ready", code: "sample_pending" }, 409);
  }

  const ttl = mode === "full" ? 60 * 5 : 60 * 15;
  const { data, error } = await admin.storage.from("song-files")
    .createSignedUrl(path, ttl);
  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ url: data.signedUrl, mode, unlocked: !!song.unlocked });
});
