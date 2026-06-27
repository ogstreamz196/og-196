// Charges the caller `coins_per_full_unlock` and flips songs.unlocked=true.
// After unlock, the client can call `song-url` with mode:"full" to download.
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { adminClient, requireUser } from "../_shared/clients.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const { song_id } = await req.json().catch(() => ({}));
    if (!song_id) return jsonResponse({ error: "Missing song_id" }, 400);

    const admin = adminClient();
    const { data: song } = await admin
      .from("songs")
      .select("id, user_id, status, unlocked, audio_path")
      .eq("id", song_id)
      .maybeSingle();
    if (!song || song.user_id !== user.id) return jsonResponse({ error: "Not found" }, 404);
    if (song.status !== "completed") return jsonResponse({ error: "Song not ready" }, 409);
    if (song.unlocked) return jsonResponse({ ok: true, already: true });

    const { data: row } = await admin
      .from("app_settings").select("value").eq("key", "coins_per_full_unlock").maybeSingle();
    const cost = typeof row?.value === "number" ? row.value : 5;

    const { data: balance, error: dErr } = await admin.rpc("deduct_coins", {
      p_user: user.id, p_amount: cost, p_reference: `unlock:${song_id}`,
    });
    if (dErr) return jsonResponse({ error: "Insufficient coins", code: "insufficient_coins" }, 402);

    const { error: uErr } = await admin.from("songs").update({ unlocked: true }).eq("id", song_id);
    if (uErr) return jsonResponse({ error: uErr.message }, 500);

    // Source-of-truth ledger entry — `song-url` checks this before issuing the full URL.
    const { error: lErr } = await admin.from("unlocked_songs").insert({
      user_id: user.id,
      song_id,
      source: "coins",
      cost_coins: cost,
      reference: `unlock:${song_id}`,
    });
    if (lErr && !String(lErr.message).includes("duplicate")) {
      return jsonResponse({ error: lErr.message }, 500);
    }

    return jsonResponse({ ok: true, coin_balance: balance, cost });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
