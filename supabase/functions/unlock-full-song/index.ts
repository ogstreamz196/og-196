// Owner unlock: charges `coins_per_full_unlock` and flips songs.unlocked=true.
// Community unlock (non-owner downloading another user's revealed track):
//   charges 2 OG coins from the buyer — 1 is burnt, 1 is transferred to the
//   song's creator as a loyalty royalty. Records an unlocked_songs ledger row
//   so song-url mode:"full" purpose:"download" can issue the signed URL.
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { adminClient, requireUser } from "../_shared/clients.ts";

const COMMUNITY_COST = 2;
const COMMUNITY_ROYALTY = 1; // remainder (COMMUNITY_COST - COMMUNITY_ROYALTY) is burnt

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
      .select("id, user_id, status, unlocked, audio_path, revealed")
      .eq("id", song_id)
      .maybeSingle();
    if (!song) return jsonResponse({ error: "Not found" }, 404);
    if (song.status !== "completed") return jsonResponse({ error: "Song not ready" }, 409);

    const isOwner = song.user_id === user.id;

    // ─── Community unlock path (non-owner) ──────────────────────────────
    if (!isOwner) {
      if (song.revealed === false) {
        return jsonResponse({ error: "Song not available", code: "not_revealed" }, 404);
      }
      const { data: existing } = await admin
        .from("unlocked_songs").select("id")
        .eq("user_id", user.id).eq("song_id", song_id).maybeSingle();
      if (existing) return jsonResponse({ ok: true, already: true, cost: COMMUNITY_COST });

      const reference = `community_unlock:${song_id}`;
      const { data: balance, error: dErr } = await admin.rpc("deduct_coins", {
        p_user: user.id, p_amount: COMMUNITY_COST, p_reference: reference,
      });
      if (dErr) return jsonResponse({ error: "Insufficient coins", code: "insufficient_coins" }, 402);

      // Royalty: credit `COMMUNITY_ROYALTY` to the creator. The remainder is burnt.
      const { data: ownerProfile } = await admin
        .from("profiles").select("coin_balance").eq("id", song.user_id).maybeSingle();
      const newOwnerBal = (ownerProfile?.coin_balance ?? 0) + COMMUNITY_ROYALTY;
      await admin.from("profiles").update({ coin_balance: newOwnerBal }).eq("id", song.user_id);
      await admin.from("coin_transactions").insert({
        user_id: song.user_id,
        amount: COMMUNITY_ROYALTY,
        type: "royalty",
        reference: `${reference}:from:${user.id}`,
      });

      const { error: lErr } = await admin.from("unlocked_songs").insert({
        user_id: user.id,
        song_id,
        source: "community_purchase",
        cost_coins: COMMUNITY_COST,
        reference,
      });
      if (lErr && !String(lErr.message).includes("duplicate")) {
        return jsonResponse({ error: lErr.message }, 500);
      }

      return jsonResponse({
        ok: true,
        coin_balance: balance,
        cost: COMMUNITY_COST,
        royalty: COMMUNITY_ROYALTY,
        burnt: COMMUNITY_COST - COMMUNITY_ROYALTY,
      });
    }

    // ─── Owner unlock path (HQ download of own song) ────────────────────
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
