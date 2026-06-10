import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { findCoinPackByBundleId } from "@/lib/coin-packs";

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function creditCoinsForSession(session: any, env: StripeEnv) {
  const meta = (session?.metadata ?? {}) as Record<string, string | undefined>;
  const userId = meta.userId;
  const bundleId = meta.bundleId;
  const coinsRaw = meta.coins;

  if (!userId || !bundleId) {
    console.warn("payments webhook: missing userId/bundleId in session metadata", { id: session?.id });
    return;
  }

  // Trust server-defined pack catalog; metadata.coins is informational only.
  const pack = findCoinPackByBundleId(bundleId);
  const coins = pack?.coins ?? (coinsRaw ? Number(coinsRaw) : 0);
  if (!coins || coins <= 0) {
    console.warn("payments webhook: unknown bundle or zero coins", { bundleId });
    return;
  }

  if (session?.payment_status && session.payment_status !== "paid") {
    console.log("payments webhook: ignoring unpaid session", session.id, session.payment_status);
    return;
  }

  const supabase = await getAdminClient();
  const sessionId: string = session?.id ?? "unknown_session";
  const reference = `stripe:${env}:${sessionId}`;

  // Idempotency: skip if we already credited this exact session.
  const { data: existing } = await supabase
    .from("coin_transactions")
    .select("id")
    .eq("reference", reference)
    .maybeSingle();
  if (existing) {
    console.log("payments webhook: already credited", reference);
    return;
  }

  // Increment balance atomically (service_role bypasses the self-protect trigger).
  const { data: profile, error: readErr } = await supabase
    .from("profiles").select("coin_balance").eq("id", userId).maybeSingle();
  if (readErr || !profile) {
    console.error("payments webhook: profile not found", userId, readErr);
    return;
  }
  const newBalance = (profile.coin_balance ?? 0) + coins;

  const { error: updateErr } = await supabase
    .from("profiles").update({ coin_balance: newBalance }).eq("id", userId);
  if (updateErr) {
    console.error("payments webhook: balance update failed", updateErr);
    return;
  }

  const { error: txErr } = await supabase.from("coin_transactions").insert({
    user_id: userId,
    amount: coins,
    type: "stripe_purchase",
    reference,
  });
  if (txErr) {
    console.error("payments webhook: tx log failed", txErr);
  }
}

async function handleEvent(event: { type: string; data: { object: any } }, env: StripeEnv) {
  switch (event.type) {
    case "checkout.session.completed":
    case "transaction.completed":
      await creditCoinsForSession(event.data.object, env);
      break;
    default:
      console.log("payments webhook: unhandled event", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("payments webhook: invalid env", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          await handleEvent(event, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("payments webhook: error", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
