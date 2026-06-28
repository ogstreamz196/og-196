// Issues a short-lived signed URL for the owner of a song to stream/download the audio file.
// Modes:
//   - "preview" (default): owner always allowed; non-owners only for completed+revealed community songs.
//   - "full": only allowed when the song has been unlocked (paid / VIP grant) by the caller.
//
// Every failure path returns a structured { error, code, reason } body and logs a single
// JSON line tagged "song-url" so the source of any 4xx (missing song, hidden, not unlocked,
// or storage object missing) is unambiguous in the function logs.
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { adminClient, requireUser } from "../_shared/clients.ts";

type Outcome =
  | "ok"
  | "missing_song_id"
  | "song_not_found"
  | "not_revealed"
  | "not_completed"
  | "locked_non_owner"
  | "locked_no_unlock_row"
  | "full_pending"
  | "sample_pending"
  | "sign_failed";

function log(outcome: Outcome, extra: Record<string, unknown>) {
  console.log(JSON.stringify({ tag: "song-url", outcome, ...extra }));
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const song_id: string | undefined = body?.song_id;
  const mode: "preview" | "full" = body?.mode === "full" ? "full" : "preview";
  const purpose: "stream" | "download" = body?.purpose === "stream" ? "stream" : "download";
  if (!song_id) {
    log("missing_song_id", { user_id: user.id, mode });
    return jsonResponse({ error: "Missing song_id", code: "missing_song_id" }, 400);
  }

  const admin = adminClient();
  const { data: song, error: songErr } = await admin.from("songs")
    .select("user_id, audio_path, sample_path, status, unlocked, revealed")
    .eq("id", song_id).maybeSingle();

  if (songErr || !song) {
    log("song_not_found", { user_id: user.id, song_id, mode, db_error: songErr?.message });
    return jsonResponse({
      error: "Song not found",
      code: "song_not_found",
      reason: "No song row exists for this id (it may have been deleted).",
    }, 404);
  }

  const isOwner = !(song.user_id !== user.id);

  if (!isOwner) {
    if (mode === "full") {
      log("locked_non_owner", { user_id: user.id, song_id });
      return jsonResponse({
        error: "Full track is locked",
        code: "locked",
        reason: "You do not own this song; the full HQ download is owner-only.",
      }, 403);
    }
    if (song.status !== "completed") {
      log("not_completed", { user_id: user.id, song_id, status: song.status });
      return jsonResponse({
        error: "Song not ready",
        code: "not_completed",
        reason: "This community song hasn't finished rendering yet.",
      }, 404);
    }
    if (song.revealed === false) {
      log("not_revealed", { user_id: user.id, song_id });
      return jsonResponse({
        error: "Song not available",
        code: "not_revealed",
        reason: "The owner hasn't revealed this song to the community yet.",
      }, 404);
    }
  }

  if (mode === "full") {
    // Require an unlocked_songs record before ever returning the full URL.
    // songs.unlocked is a denormalised mirror; the unlock ledger is the source of truth.
    const { data: unlockRow } = await admin
      .from("unlocked_songs")
      .select("id")
      .eq("user_id", user.id)
      .eq("song_id", song_id)
      .maybeSingle();
    if (!unlockRow) {
      log("locked_no_unlock_row", { user_id: user.id, song_id, mirror_unlocked: !!song.unlocked });
      return jsonResponse({
        error: "Full track is locked",
        code: "locked",
        reason: "No unlock ledger entry — unlock the HQ track first.",
      }, 403);
    }
    if (!song.audio_path) {
      log("full_pending", { user_id: user.id, song_id });
      return jsonResponse({
        error: "Full track still downloading",
        code: "full_pending",
        reason: "Unlock recorded but the HQ audio file hasn't been mirrored to storage yet.",
      }, 409);
    }
  }

  const path = mode === "full" ? song.audio_path! : song.sample_path;
  if (!path) {
    const code = mode === "full" ? "full_pending" : "sample_pending";
    log(code, { user_id: user.id, song_id, mode });
    return jsonResponse({
      error: mode === "full" ? "Full track not ready" : "Sample not ready",
      code,
      reason: "Storage path missing — generation may still be in progress.",
    }, 409);
  }

  const ttl = mode === "full" ? 60 * 5 : 60 * 15;
  const { data, error } = await admin.storage.from("song-files")
    .createSignedUrl(path, ttl);
  if (error) {
    log("sign_failed", { user_id: user.id, song_id, mode, error: error.message });
    return jsonResponse({ error: error.message, code: "sign_failed" }, 500);
  }

  log("ok", { user_id: user.id, song_id, mode, owner: isOwner });
  return jsonResponse({ url: data.signedUrl, mode, unlocked: !!song.unlocked });
});
