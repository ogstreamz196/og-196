// Owner unlock: charges `coins_per_full_unlock` and flips songs.unlocked=true.
// Community unlock (non-owner downloading another user's revealed track):
//   charges 3 OG coins from the buyer — 2 are burnt, 1 is transferred to the
//   song's creator as a loyalty royalty. Records an unlocked_songs ledger row
//   so song-url mode:"full" purpose:"download" can issue the signed URL.
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { adminClient, requireUser } from "../_shared/clients.ts";

const COMMUNITY_COST = 3;
const COMMUNITY_ROYALTY = 1; // remainder (COMMUNITY_COST - COMMUNITY_ROYALTY) is burnt

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const { song_id, bundle_both } = await req.json().catch(() => ({}));
    if (!song_id) return jsonResponse({ error: "Missing song_id" }, 400);

    const admin = adminClient();
    const { data: song } = await admin
      .from("songs")
      .select("id, user_id, status, unlocked, audio_path, revealed, title, suno_task_id")
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

      // Celebrate with the creator: someone downloaded their track.
      await admin.from("user_notifications").insert({
        user_id: song.user_id,
        kind: "track_download",
        title: "Your track was downloaded!",
        body: `Someone just downloaded "${song.title ?? "your track"}" and you earned ${COMMUNITY_ROYALTY} loyalty OG coin.`,
        metadata: {
          song_id,
          coins: COMMUNITY_ROYALTY,
          downloader: user.id,
        },
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
    if (song.unlocked && !bundle_both) return jsonResponse({ ok: true, already: true });

    const { data: settingRows } = await admin
      .from("app_settings").select("key, value").in(
        "key",
        ["coins_per_full_unlock", "coins_per_remake"],
      );
    const settings = new Map(
      (settingRows ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]),
    );
    const unlockCost = typeof settings.get("coins_per_full_unlock") === "number"
      ? (settings.get("coins_per_full_unlock") as number)
      : 5;
    const remakeRaw = Number(settings.get("coins_per_remake"));
    const remakeCost = Number.isFinite(remakeRaw) && remakeRaw >= 1 ? Math.round(remakeRaw) : 2;

    // Optional second take: the paired clip from the same generation. It counts
    // whether or not it was already revealed — only "still locked" matters.
    let sibling: { id: string } | null = null;
    if (bundle_both && song.suno_task_id) {
      const { data: sibs } = await admin
        .from("songs")
        .select("id")
        .eq("suno_task_id", song.suno_task_id)
        .eq("user_id", user.id)
        .eq("unlocked", false)
        .neq("id", song_id)
        .limit(1);
      sibling = (sibs ?? [])[0] ?? null;
    }

    const alreadyUnlocked = !!song.unlocked;
    const cost = (alreadyUnlocked ? 0 : unlockCost) + (sibling ? remakeCost : 0);
    if (cost === 0) return jsonResponse({ ok: true, already: true });

    // Claim the sibling unlock atomically before charging so retries can't double up.
    if (sibling) {
      const { data: claimed } = await admin
        .from("songs")
        .update({ unlocked: true, revealed: true })
        .eq("id", sibling.id).eq("user_id", user.id).eq("unlocked", false)
        .select("id");
      if (!claimed || claimed.length === 0) sibling = null;
    }

    const reference = `unlock:${song_id}${sibling ? `+take2:${sibling.id}` : ""}`;
    const { data: balance, error: dErr } = await admin.rpc("deduct_coins", {
      p_user: user.id,
      p_amount: (alreadyUnlocked ? 0 : unlockCost) + (sibling ? remakeCost : 0),
      p_reference: reference,
    });
    if (dErr) {
      if (sibling) {
        await admin.from("songs").update({ unlocked: false }).eq("id", sibling.id);
      }
      return jsonResponse({ error: "Insufficient coins", code: "insufficient_coins" }, 402);
    }

    const ids = alreadyUnlocked ? [] : [song_id];
    if (sibling) ids.push(sibling.id);
    if (ids.length > 0) {
      const { error: uErr } = await admin.from("songs").update({ unlocked: true }).in("id", ids);
      if (uErr) return jsonResponse({ error: uErr.message }, 500);
      for (const id of ids) {
        const { error: lErr } = await admin.from("unlocked_songs").insert({
          user_id: user.id,
          song_id: id,
          source: "coins",
          cost_coins: id === song_id ? unlockCost : remakeCost,
          reference: `unlock:${id}`,
        });
        if (lErr && !String(lErr.message).includes("duplicate")) {
          return jsonResponse({ error: lErr.message }, 500);
        }
      }
    }

    return jsonResponse({
      ok: true,
      coin_balance: balance,
      cost,
      second_take: sibling?.id ?? null,
    });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
