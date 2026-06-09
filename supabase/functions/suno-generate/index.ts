// Suno generation edge function.
// - Verifies the calling user
// - Deducts 3 coins atomically (refunds on Suno API failure)
// - Calls the Suno API (configured for sunoapi.org pattern; adjust for other providers)
// - Inserts a 'pending' songs row; the suno-callback function fills it in when audio is ready
//
// If you use a different Suno API provider, change SUNO_API_URL and the request body shape.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY")!;

// Third-party Suno gateway. Replace if you use a different provider.
const SUNO_API_URL = "https://apibox.erweima.ai/api/v1/generate";
const COIN_COST = 3;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const prompt = (body.prompt ?? "").toString().trim();
    const style = (body.style ?? "").toString().trim() || null;
    const lyrics = (body.lyrics ?? "").toString().trim() || null;
    const title = (body.title ?? "").toString().trim() || null;
    const instrumental = !!body.instrumental;

    if (!prompt && !lyrics) return json({ error: "Provide a prompt or lyrics" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Create song row first so we have an ID to reference in coin transactions / callback
    const { data: song, error: songErr } = await admin
      .from("songs")
      .insert({
        user_id: user.id,
        prompt,
        style,
        lyrics,
        title,
        status: "pending",
      })
      .select()
      .single();
    if (songErr) return json({ error: songErr.message }, 500);

    // Atomic coin deduction
    const { data: balance, error: deductErr } = await admin.rpc("deduct_coins", {
      p_user: user.id,
      p_amount: COIN_COST,
      p_reference: song.id,
    });
    if (deductErr) {
      await admin.from("songs").update({ status: "failed", error_message: "Insufficient coins" }).eq("id", song.id);
      return json({ error: "Insufficient coins", code: "insufficient_coins" }, 402);
    }

    // Build Suno callback URL (public). suno-callback is verify_jwt=false.
    const callbackUrl = `${SUPABASE_URL}/functions/v1/suno-callback?song_id=${song.id}`;

    // Call Suno API. Shape follows sunoapi.org's /api/v1/generate.
    let sunoRes: Response;
    try {
      sunoRes = await fetch(SUNO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUNO_API_KEY}`,
        },
        body: JSON.stringify({
          prompt: lyrics || prompt,
          style: style || undefined,
          title: title || undefined,
          customMode: !!(style || lyrics || title),
          instrumental,
          model: "V4",
          callBackUrl: callbackUrl,
        }),
      });
    } catch (e) {
      await refund(admin, user.id, song.id, "Suno API unreachable");
      return json({ error: "Suno API unreachable" }, 502);
    }

    const sunoText = await sunoRes.text();
    if (!sunoRes.ok) {
      console.error("Suno API error", sunoRes.status, sunoText);
      await refund(admin, user.id, song.id, `Suno API ${sunoRes.status}: ${sunoText.slice(0, 200)}`);
      return json({ error: "Suno API rejected the request", details: sunoText.slice(0, 300) }, 502);
    }

    let sunoBody: any = {};
    try { sunoBody = JSON.parse(sunoText); } catch { /* keep empty */ }
    const taskId = sunoBody?.data?.taskId ?? sunoBody?.taskId ?? sunoBody?.task_id ?? null;

    await admin.from("songs").update({ status: "processing", suno_task_id: taskId }).eq("id", song.id);

    return json({ song_id: song.id, task_id: taskId, coin_balance: balance });
  } catch (e) {
    console.error("Unhandled error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function refund(admin: any, userId: string, songId: string, reason: string) {
  await admin.from("songs").update({ status: "failed", error_message: reason }).eq("id", songId);
  await admin.from("profiles").update({ coin_balance: undefined }).eq("id", userId); // no-op trigger refresh
  // credit back
  await admin.rpc; // (placeholder)
  await admin.from("coin_transactions").insert({
    user_id: userId,
    amount: COIN_COST,
    type: "refund",
    reference: songId,
  });
  // Restore the balance value
  const { data: prof } = await admin.from("profiles").select("coin_balance").eq("id", userId).single();
  await admin.from("profiles").update({ coin_balance: (prof?.coin_balance ?? 0) + COIN_COST }).eq("id", userId);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
