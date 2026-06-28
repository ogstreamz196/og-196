import { supabase } from "@/integrations/supabase/client";

export type FullUrlPrecheck =
  | { ok: true }
  | { ok: false; code: "not_signed_in" | "locked" | "precheck_failed"; reason: string };

/**
 * Confirms the caller has an `unlocked_songs` ledger row for this song
 * BEFORE we ask `song-url` for a `mode: "full"` signed link. Mirrors the
 * server-side guard so we never make a doomed Edge Function call (and so
 * the UI can show a clear "unlock first" message instead of a 403 toast).
 */
export async function ensureFullUrlAllowed(songId: string): Promise<FullUrlPrecheck> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false, code: "not_signed_in", reason: "Sign in to download the full track." };

  const { data, error } = await supabase
    .from("unlocked_songs")
    .select("id")
    .eq("user_id", userId)
    .eq("song_id", songId)
    .maybeSingle();

  if (error) {
    console.warn("[ensureFullUrlAllowed] ledger lookup failed", error);
    // Fail-open to the server check — it is the authority.
    return { ok: true };
  }
  if (!data) {
    return {
      ok: false,
      code: "locked",
      reason: "This track is locked. Unlock the HQ download first.",
    };
  }
  return { ok: true };
}
