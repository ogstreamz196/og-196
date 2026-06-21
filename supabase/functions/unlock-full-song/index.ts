// Charges the caller `coins_per_full_unlock` and flips songs.unlocked=true.
// After unlock, the client can call `song-url` with mode:"full" to download.
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

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Missing auth" }, 401);

    const anon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, anon, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "Unauthorized" }, 401);

    const { song_id } = await req.json().catch(() => ({}));
    if (!song_id) return j({ error: "Missing song_id" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: song } = await admin
      .from("songs")
      .select("id, user_id, status, unlocked, audio_path")
      .eq("id", song_id)
      .maybeSingle();
    if (!song || song.user_id !== user.id) return j({ error: "Not found" }, 404);
    if (song.status !== "completed") return j({ error: "Song not ready" }, 409);
    if (song.unlocked) return j({ ok: true, already: true });

    const { data: row } = await admin
      .from("app_settings").select("value").eq("key", "coins_per_full_unlock").maybeSingle();
    const cost = typeof row?.value === "number" ? row.value : 5;

    const { data: balance, error: dErr } = await admin.rpc("deduct_coins", {
      p_user: user.id, p_amount: cost, p_reference: `unlock:${song_id}`,
    });
    if (dErr) return j({ error: "Insufficient coins", code: "insufficient_coins" }, 402);

    const { error: uErr } = await admin.from("songs").update({ unlocked: true }).eq("id", song_id);
    if (uErr) return j({ error: uErr.message }, 500);

    return j({ ok: true, coin_balance: balance, cost });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...cors },
  });
}
