// Charges half (admin-configurable divisor) of coins_per_generation to reveal
// a hidden Suno alt-take. Used by both the instant "Reveal" button and the
// "Checkout basket" batch flow on the client (which calls this once per item).
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
  if (!song_id) return jsonResponse({ error: "Missing song_id" }, 400);

  const admin = adminClient();

  const { data: song } = await admin.from("songs")
    .select("id, user_id, is_variation, revealed")
    .eq("id", song_id).single();
  if (!song || song.user_id !== user.id) return jsonResponse({ error: "Not found" }, 404);
  if (!song.is_variation) return jsonResponse({ error: "Not a variation" }, 400);
  if (song.revealed) return jsonResponse({ ok: true, already: true });

  // Pricing: ceil(coins_per_generation / coins_per_variation_divisor)
  const { data: rows } = await admin.from("app_settings")
    .select("key, value").in("key", ["coins_per_generation", "coins_per_variation_divisor"]);
  const map = new Map((rows ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const base = Number(map.get("coins_per_generation") ?? 4);
  const div = Math.max(1, Number(map.get("coins_per_variation_divisor") ?? 2));
  const cost = Math.max(1, Math.ceil(base / div));

  const { error: deductErr } = await admin.rpc("deduct_coins", {
    p_user: user.id, p_amount: cost, p_reference: `variation:${song_id}`,
  });
  if (deductErr) return jsonResponse({ error: deductErr.message, code: "insufficient_coins" }, 402);

  const { error: upErr } = await admin.from("songs")
    .update({ revealed: true }).eq("id", song_id);
  if (upErr) {
    // Best-effort refund — mirrors suno-callback pattern.
    await admin.from("coin_transactions").insert({
      user_id: user.id, amount: cost, type: "refund", reference: `variation_refund:${song_id}`,
    });
    const { data: prof } = await admin.from("profiles").select("coin_balance").eq("id", user.id).single();
    await admin.from("profiles").update({ coin_balance: (prof?.coin_balance ?? 0) + cost }).eq("id", user.id);
    return jsonResponse({ error: upErr.message }, 500);
  }

  return jsonResponse({ ok: true, cost });
});
