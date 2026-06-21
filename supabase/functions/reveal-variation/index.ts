// Charges half (admin-configurable divisor) of coins_per_generation to reveal
// a hidden Suno alt-take. Used by both the instant "Reveal" button and the
// "Checkout basket" batch flow on the client (which calls this once per item).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return j({ error: "Missing auth" }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return j({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const song_id: string | undefined = body?.song_id;
  if (!song_id) return j({ error: "Missing song_id" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: song } = await admin.from("songs")
    .select("id, user_id, is_variation, revealed")
    .eq("id", song_id).single();
  if (!song || song.user_id !== user.id) return j({ error: "Not found" }, 404);
  if (!song.is_variation) return j({ error: "Not a variation" }, 400);
  if (song.revealed) return j({ ok: true, already: true });

  // Pricing: ceil(coins_per_generation / coins_per_variation_divisor)
  const { data: rows } = await admin.from("app_settings")
    .select("key, value").in("key", ["coins_per_generation", "coins_per_variation_divisor"]);
  const map = new Map((rows ?? []).map((r: any) => [r.key, r.value]));
  const base = Number(map.get("coins_per_generation") ?? 4);
  const div = Math.max(1, Number(map.get("coins_per_variation_divisor") ?? 2));
  const cost = Math.max(1, Math.ceil(base / div));

  const { error: deductErr } = await admin.rpc("deduct_coins", {
    p_user: user.id, p_amount: cost, p_reference: `variation:${song_id}`,
  });
  if (deductErr) return j({ error: deductErr.message, code: "insufficient_coins" }, 402);

  const { error: upErr } = await admin.from("songs")
    .update({ revealed: true }).eq("id", song_id);
  if (upErr) {
    // Best-effort refund.
    await admin.from("coin_transactions").insert({
      user_id: user.id, amount: cost, type: "refund", reference: `variation_refund:${song_id}`,
    });
    return j({ error: upErr.message }, 500);
  }

  return j({ ok: true, cost });
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...cors },
  });
}
