import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { findCoinPackByBundleId, isVipBundle } from "@/lib/coin-packs";

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ─── structured logging ────────────────────────────────────────────────────
function log(
  level: "info" | "warn" | "error",
  msg: string,
  ctx: Record<string, unknown> = {},
) {
  const line = { ts: new Date().toISOString(), level, scope: "payments.webhook", msg, ...ctx };
  if (level === "error") console.error(JSON.stringify(line));
  else if (level === "warn") console.warn(JSON.stringify(line));
  else console.log(JSON.stringify(line));
}

// ─── idempotency ───────────────────────────────────────────────────────────
/**
 * Returns true if this event has been seen before (already processed).
 * Inserts a row otherwise — using the unique PK on event_id, parallel
 * deliveries race safely (one insert wins, the other returns "already seen").
 */
async function alreadyProcessed(
  eventId: string,
  eventType: string,
  env: StripeEnv,
  summary: Record<string, unknown>,
): Promise<boolean> {
  const supabase = await getAdminClient();
  const { error } = await supabase.from("stripe_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    environment: env,
    payload_summary: summary,
  });
  if (!error) return false;
  // 23505 unique_violation = duplicate delivery
  const code = (error as { code?: string }).code;
  if (code === "23505") {
    log("info", "duplicate event ignored", { eventId, eventType, env });
    return true;
  }
  // Unknown insert failure — log and fall through to processing so we don't
  // silently drop legitimate events. Stripe will retry on a non-200 anyway.
  log("error", "idempotency insert failed", { eventId, error: String(error.message ?? error) });
  return false;
}

// ─── coin crediting (one-off purchases) ────────────────────────────────────
async function creditCoinsForSession(session: any, env: StripeEnv) {
  const meta = (session?.metadata ?? {}) as Record<string, string | undefined>;
  const userId = meta.userId;
  const bundleId = meta.bundleId;
  const coinsRaw = meta.coins;

  if (!userId || !bundleId) {
    log("warn", "missing userId/bundleId in session metadata", { sessionId: session?.id });
    return;
  }

  const metaCoins = coinsRaw ? Number(coinsRaw) : 0;
  const pack = findCoinPackByBundleId(bundleId);
  const coins = Number.isFinite(metaCoins) && metaCoins > 0 ? metaCoins : (pack?.coins ?? 0);
  if (!coins || coins <= 0) {
    log("warn", "unknown bundle or zero coins", { bundleId });
    return;
  }

  if (session?.payment_status && session.payment_status !== "paid") {
    log("info", "ignoring unpaid session", { sessionId: session.id, status: session.payment_status });
    return;
  }

  const supabase = await getAdminClient();
  const sessionId: string = session?.id ?? "unknown_session";
  const reference = `stripe:${env}:${sessionId}`;

  const { data: existing } = await supabase
    .from("coin_transactions").select("id").eq("reference", reference).maybeSingle();
  if (existing) {
    log("info", "coins already credited", { reference });
    return;
  }

  const { data: profile, error: readErr } = await supabase
    .from("profiles").select("coin_balance").eq("id", userId).maybeSingle();
  if (readErr || !profile) {
    log("error", "profile not found for credit", { userId, err: String(readErr?.message ?? "") });
    return;
  }
  const newBalance = (profile.coin_balance ?? 0) + coins;

  const { error: updateErr } = await supabase
    .from("profiles").update({ coin_balance: newBalance }).eq("id", userId);
  if (updateErr) {
    log("error", "balance update failed", { userId, err: updateErr.message });
    return;
  }

  const { error: txErr } = await supabase.from("coin_transactions").insert({
    user_id: userId, amount: coins, type: "stripe_purchase", reference,
  });
  if (txErr) log("error", "tx log failed", { reference, err: txErr.message });
  else log("info", "coins credited", { userId, coins, reference });
}

// ─── VIP role + subscription mirror ────────────────────────────────────────
async function grantVipRole(userId: string, ctx: Record<string, unknown>) {
  const supabase = await getAdminClient();
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "vip" }, { onConflict: "user_id,role" });
  if (error) log("error", "VIP grant failed", { userId, err: error.message, ...ctx });
  else log("info", "VIP granted", { userId, ...ctx });
}

async function revokeVipRole(userId: string, ctx: Record<string, unknown>) {
  const supabase = await getAdminClient();
  const { error } = await supabase
    .from("user_roles").delete().eq("user_id", userId).eq("role", "vip");
  if (error) log("error", "VIP revoke failed", { userId, err: error.message, ...ctx });
  else log("info", "VIP revoked", { userId, ...ctx });
}

async function upsertSubscriptionRow(subscription: any, env: StripeEnv) {
  const meta = (subscription?.metadata ?? {}) as Record<string, string | undefined>;
  const userId = meta.userId;
  if (!userId) {
    log("warn", "subscription event missing userId metadata", { subId: subscription?.id });
    return null;
  }
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id
    || null;
  const productId = item?.price?.product ?? null;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const supabase = await getAdminClient();
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) log("error", "subscription upsert failed", { subId: subscription.id, err: error.message });
  return userId;
}

async function syncVipFromSubscription(subscription: any, env: StripeEnv) {
  const userId = await upsertSubscriptionRow(subscription, env);
  if (!userId) return;
  const status = subscription?.status as string | undefined;
  // Active / trialing / past_due (grace) keep VIP. cancel_at_period_end with
  // future period_end still keeps access until that date — we keep the role
  // and let `customer.subscription.deleted` revoke at expiry.
  const keep = status === "active" || status === "trialing" || status === "past_due";
  const ctx = { subId: subscription.id, status, env };
  if (keep) await grantVipRole(userId, ctx);
  else await revokeVipRole(userId, ctx);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const userId = await upsertSubscriptionRow({ ...subscription, status: "canceled" }, env);
  if (userId) await revokeVipRole(userId, { subId: subscription.id, env, reason: "deleted" });
}

// One-off VIP grant from checkout completion (bundleId === vip_monthly).
// Subscription webhooks will then keep the row in sync.
async function grantVipFromCheckout(session: any, env: StripeEnv) {
  const userId = session?.metadata?.userId as string | undefined;
  if (!userId) {
    log("warn", "vip checkout missing userId", { sessionId: session?.id });
    return;
  }
  if (session?.payment_status && session.payment_status !== "paid" && session?.status !== "complete") {
    log("info", "ignoring unpaid vip checkout", { sessionId: session.id });
    return;
  }
  await grantVipRole(userId, { sessionId: session.id, env, source: "checkout" });
}

// ─── dispatch ──────────────────────────────────────────────────────────────
async function handleEvent(event: { id: string; type: string; data: { object: any } }, env: StripeEnv) {
  log("info", "handling event", { eventId: event.id, type: event.type, env });
  switch (event.type) {
    case "checkout.session.completed":
    case "transaction.completed": {
      const session = event.data.object;
      const bundleId = session?.metadata?.bundleId;
      if (isVipBundle(bundleId)) await grantVipFromCheckout(session, env);
      else await creditCoinsForSession(session, env);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncVipFromSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      log("info", "unhandled event", { type: event.type });
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          log("error", "invalid env param", { rawEnv });
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = (await verifyWebhook(request, env)) as {
            id: string; type: string; data: { object: any };
          };
          if (!event?.id || !event?.type) {
            log("error", "event missing id/type", {});
            return Response.json({ received: true, ignored: "shape" });
          }

          const summary = {
            objectId: event.data?.object?.id,
            customer: event.data?.object?.customer,
            status: event.data?.object?.status,
            bundleId: event.data?.object?.metadata?.bundleId,
          };

          if (await alreadyProcessed(event.id, event.type, env, summary)) {
            return Response.json({ received: true, duplicate: true });
          }

          await handleEvent(event, env);
          return Response.json({ received: true });
        } catch (e) {
          log("error", "webhook error", { err: String((e as Error)?.message ?? e) });
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
