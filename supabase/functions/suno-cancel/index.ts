// Cancels an in-flight Suno generation: marks the song failed and refunds coins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { song_id } = await req.json();
    if (!song_id) return json({ error: "Missing song_id" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: song } = await admin
      .from("songs")
      .select("id, user_id, status, portal_id")
      .eq("id", song_id)
      .maybeSingle();
    if (!song) return json({ error: "Song not found" }, 404);
    if (song.user_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (song.status !== "pending" && song.status !== "processing") {
      return json({ ok: true, already: true });
    }

    let refundAmt = 3;
    if (song.portal_id) {
      const { data: portal } = await admin
        .from("portals").select("coin_cost_per_generation").eq("id", song.portal_id).maybeSingle();
      if (typeof portal?.coin_cost_per_generation === "number") refundAmt = portal.coin_cost_per_generation;
    } else {
      const { data: setting } = await admin
        .from("app_settings").select("value").eq("key", "coins_per_generation").maybeSingle();
      if (typeof setting?.value === "number") refundAmt = setting.value;
    }

    await admin.from("songs").update({
      status: "failed",
      error_message: "Cancelled by user",
      suno_task_id: null,
    }).eq("id", song_id);

    const { error: refundErr } = await admin.rpc("refund_generation_charge", {
      p_user: user.id,
      p_amount: refundAmt,
      p_reference: song_id,
    });
    if (refundErr) console.error("Refund failed", refundErr.message);

    return json({ ok: true, refunded: refundAmt });
  } catch (e) {
    console.error("suno-cancel error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
