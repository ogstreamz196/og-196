// Admin-only mint / award / deduct coins.
// Verifies the caller is an admin, then invokes the locked public.mint_coins RPC.
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin-guard.ts";

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  try {
    const guard = await requireAdmin(req);
    if (guard.error) return guard.error;
    const { admin, userClient } = guard;

    const body = await req.json().catch(() => ({}));
    const targetEmail = (body.email ?? "").toString().trim().toLowerCase();
    const targetUserId = (body.user_id ?? "").toString().trim();
    const amount = Number(body.amount);
    const reason = (body.reason ?? "admin_mint").toString().slice(0, 200);

    if (!Number.isInteger(amount) || amount === 0) {
      return jsonResponse({ error: "Amount must be a non-zero integer" }, 400);
    }
    if (Math.abs(amount) > 100_000) {
      return jsonResponse({ error: "Amount out of range" }, 400);
    }
    if (!targetEmail && !targetUserId) {
      return jsonResponse({ error: "Provide email or user_id" }, 400);
    }

    let resolvedId = targetUserId;
    if (!resolvedId) {
      const { data: prof, error: profErr } = await admin
        .from("profiles").select("id").ilike("email", targetEmail).maybeSingle();
      if (profErr) return jsonResponse({ error: profErr.message }, 500);
      if (!prof) return jsonResponse({ error: "User not found" }, 404);
      resolvedId = (prof as { id: string }).id;
    }

    // Run the RPC under the admin's JWT so has_role(auth.uid()) passes inside the function.
    const { data: newBalance, error: rpcErr } = await userClient.rpc("mint_coins", {
      p_target: resolvedId, p_amount: amount, p_reason: reason,
    });
    if (rpcErr) return jsonResponse({ error: rpcErr.message }, 400);

    return jsonResponse({ ok: true, user_id: resolvedId, new_balance: newBalance, amount });
  } catch (e) {
    console.error("admin-mint-coins error", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
