// Admin-only mint / award / deduct coins.
// Verifies the caller is an admin, then invokes the locked public.mint_coins RPC.
// Regular users get 403 even if they craft the request manually.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLISHABLE = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

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

    const userClient = createClient(SUPABASE_URL, PUBLISHABLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id, _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetEmail = (body.email ?? "").toString().trim().toLowerCase();
    const targetUserId = (body.user_id ?? "").toString().trim();
    const amount = Number(body.amount);
    const reason = (body.reason ?? "admin_mint").toString().slice(0, 200);

    if (!Number.isInteger(amount) || amount === 0) {
      return json({ error: "Amount must be a non-zero integer" }, 400);
    }
    if (Math.abs(amount) > 100_000) {
      return json({ error: "Amount out of range" }, 400);
    }
    if (!targetEmail && !targetUserId) {
      return json({ error: "Provide email or user_id" }, 400);
    }

    let resolvedId = targetUserId;
    if (!resolvedId) {
      const { data: prof, error: profErr } = await admin
        .from("profiles").select("id").ilike("email", targetEmail).maybeSingle();
      if (profErr) return json({ error: profErr.message }, 500);
      if (!prof) return json({ error: "User not found" }, 404);
      resolvedId = prof.id;
    }

    // Run the RPC under the admin's JWT so has_role(auth.uid()) passes inside the function.
    const { data: newBalance, error: rpcErr } = await userClient.rpc("mint_coins", {
      p_target: resolvedId, p_amount: amount, p_reason: reason,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 400);

    return json({ ok: true, user_id: resolvedId, new_balance: newBalance, amount });
  } catch (e) {
    console.error("admin-mint-coins error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
