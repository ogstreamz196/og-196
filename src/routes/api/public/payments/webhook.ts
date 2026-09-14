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
    payload_summary: summary as never,
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

  // Atomic + idempotent: the DB helper inserts the Stripe ledger row and only
  // the caller that wins that insert increments the wallet. This prevents both
  // lost credits and double credits when the return-page reconcile races the
  // Stripe webhook.
  const { data: result, error: creditErr } = await (supabase as any)
    .rpc("credit_coin_transaction", {
      _user_id: userId,
      _amount: coins,
      _type: "stripe_purchase",
      _reference: reference,
    });
  if (creditErr) {
    log("error", "coin credit failed", { userId, reference, err: creditErr.message });
    return;
  }

  const credited = Boolean((result as { credited?: boolean } | null)?.credited);
  const newBalance = Number((result as { balance?: number } | null)?.balance ?? 0);
  if (credited) log("info", "coins credited", { userId, coins, reference, newBalance });
  else log("info", "coins already credited", { userId, coins, reference, newBalance });
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
  const cancelAtPeriodEnd = !!subscription?.cancel_at_period_end;
  // Active / trialing / past_due (grace) keep VIP. Per product decision:
  // when the user requests cancellation (cancel_at_period_end=true), revoke
  // VIP perks immediately rather than waiting for period end.
  const keep =
    !cancelAtPeriodEnd &&
    (status === "active" || status === "trialing" || status === "past_due");
  const ctx = { subId: subscription.id, status, cancelAtPeriodEnd, env };
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

// ─── one-off card unlock of a single track (99p) ───────────────────────────
async function fulfilTrackUnlock(session: any, env: StripeEnv) {
  const meta = (session?.metadata ?? {}) as Record<string, string | undefined>;
  const userId = meta.userId;
  const songId = meta.songId;
  if (!userId || !songId) {
    log("warn", "track unlock missing metadata", { sessionId: session?.id });
    return;
  }
  if (session?.payment_status && session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    log("info", "ignoring unpaid track unlock", { sessionId: session.id });
    return;
  }
  const { grantTrackUnlock } = await import("@/lib/track-unlock.server");
  const result = await grantTrackUnlock(userId, songId, `stripe:${env}:${session.id}`);
  if (!result.ok) log("error", "track unlock failed", { userId, songId, err: result.error });
  else log("info", "track unlocked via card", { userId, songId, already: result.already });
}

// ─── refunds ───────────────────────────────────────────────────────────────
// Given a Stripe refund (or charge.refunded charge), resolve the user_id and
// upsert a row in payment_refunds keyed by refund id (idempotent).
async function upsertRefundRow(opts: {
  refundId: string;
  chargeId: string | null;
  paymentIntentId: string | null;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  failureReason: string | null;
  env: StripeEnv;
}) {
  const supabase = await getAdminClient();
  // Resolve session + user via PI (most reliable — checkout session metadata
  // carries our userId, and we filter by payment_intent on the session list).
  let userId: string | null = null;
  let sessionId: string | null = null;
  if (opts.paymentIntentId) {
    try {
      const { createStripeClient } = await import("@/lib/stripe.server");
      const stripe = createStripeClient(opts.env);
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: opts.paymentIntentId,
        limit: 1,
      });
      const s = sessions.data[0];
      if (s) {
        sessionId = s.id;
        userId = (s.metadata?.userId as string | undefined) ?? null;
      }
    } catch (e) {
      log("warn", "refund session lookup failed", {
        refundId: opts.refundId,
        err: String((e as Error)?.message ?? e),
      });
    }
  }
  // Fallback: previous webhook row keyed by session in coin_transactions.
  if (!userId && sessionId) {
    const { data: tx } = await supabase
      .from("coin_transactions")
      .select("user_id")
      .eq("reference", `stripe:${opts.env}:${sessionId}`)
      .maybeSingle();
    userId = (tx?.user_id as string | undefined) ?? null;
  }
  if (!userId) {
    log("warn", "refund missing user_id; skipping upsert", { refundId: opts.refundId });
    return;
  }
  const { error } = await supabase.from("payment_refunds").upsert(
    {
      user_id: userId,
      stripe_refund_id: opts.refundId,
      stripe_charge_id: opts.chargeId,
      stripe_payment_intent_id: opts.paymentIntentId,
      stripe_session_id: sessionId,
      amount: opts.amount,
      currency: opts.currency,
      status: opts.status,
      reason: opts.reason,
      failure_reason: opts.failureReason,
      environment: opts.env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_refund_id" },
  );
  if (error) log("error", "refund upsert failed", { refundId: opts.refundId, err: error.message });
  else log("info", "refund upserted", { refundId: opts.refundId, status: opts.status, userId });

  // Clawback coins for successful refunds of coin-pack purchases. VIP
  // subscription refunds are handled by subscription.deleted (role revoke).
  if (opts.status === "succeeded" && sessionId) {
    await clawbackCoinsForRefund({
      userId,
      sessionId,
      refundId: opts.refundId,
      env: opts.env,
    });
  }
}

// Deduct coins originally credited for a coin-pack purchase when that
// purchase is refunded. Allowed to push the balance negative per product
// decision. Idempotent via the `stripe:refund:<id>` reference.
async function clawbackCoinsForRefund(opts: {
  userId: string;
  sessionId: string;
  refundId: string;
  env: StripeEnv;
}) {
  const supabase = await getAdminClient();
  const reference = `stripe:refund:${opts.refundId}`;
  const { data: already } = await supabase
    .from("coin_transactions").select("id").eq("reference", reference).maybeSingle();
  if (already) {
    log("info", "refund clawback already applied", { reference });
    return;
  }
  const purchaseRef = `stripe:${opts.env}:${opts.sessionId}`;
  const { data: orig } = await supabase
    .from("coin_transactions")
    .select("amount")
    .eq("reference", purchaseRef)
    .eq("type", "stripe_purchase")
    .maybeSingle();
  const coins = Number(orig?.amount ?? 0);
  if (!coins || coins <= 0) {
    log("info", "no original coin purchase to claw back", { purchaseRef });
    return;
  }
  const { data: profile } = await supabase
    .from("profiles").select("coin_balance").eq("id", opts.userId).maybeSingle();
  const newBalance = (profile?.coin_balance ?? 0) - coins;
  const { error: updErr } = await supabase
    .from("profiles").update({ coin_balance: newBalance }).eq("id", opts.userId);
  if (updErr) {
    log("error", "clawback balance update failed", { userId: opts.userId, err: updErr.message });
    return;
  }
  const { error: txErr } = await supabase.from("coin_transactions").insert({
    user_id: opts.userId, amount: -coins, type: "stripe_refund", reference,
  });
  if (txErr) log("error", "clawback tx log failed", { reference, err: txErr.message });
  else log("info", "coins clawed back", { userId: opts.userId, coins, reference, newBalance });
}

async function handleRefundEvent(refund: any, env: StripeEnv) {
  await upsertRefundRow({
    refundId: refund.id,
    chargeId: (typeof refund.charge === "string" ? refund.charge : refund.charge?.id) ?? null,
    paymentIntentId:
      (typeof refund.payment_intent === "string"
        ? refund.payment_intent
        : refund.payment_intent?.id) ?? null,
    amount: refund.amount ?? 0,
    currency: refund.currency ?? "gbp",
    status: refund.status ?? "pending",
    reason: refund.reason ?? null,
    failureReason: refund.failure_reason ?? null,
    env,
  });
}

async function handleChargeRefunded(charge: any, env: StripeEnv) {
  const refunds: any[] = charge?.refunds?.data ?? [];
  if (!refunds.length) {
    log("info", "charge.refunded with no refund objects", { chargeId: charge?.id });
    return;
  }
  for (const r of refunds) {
    await upsertRefundRow({
      refundId: r.id,
      chargeId: charge.id ?? null,
      paymentIntentId:
        (typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id) ?? null,
      amount: r.amount ?? 0,
      currency: r.currency ?? charge.currency ?? "gbp",
      status: r.status ?? "succeeded",
      reason: r.reason ?? null,
      failureReason: r.failure_reason ?? null,
      env,
    });
  }
}

// ─── store items (CMS-created products) ────────────────────────────────────
async function fulfilStoreItemCheckout(session: any, env: StripeEnv) {
  const meta = (session?.metadata ?? {}) as Record<string, string | undefined>;
  const userId = meta.userId;
  const itemId = meta.storeItemId;
  if (!userId || !itemId) {
    log("warn", "store checkout missing userId/itemId", { sessionId: session?.id });
    return;
  }
  if (session?.payment_status && session.payment_status !== "paid" && session.mode !== "subscription") {
    log("info", "ignoring unpaid store session", { sessionId: session.id });
    return;
  }
  const supabase = await getAdminClient();
  const { data: item } = await supabase
    .from("store_items").select("*").eq("id", itemId).maybeSingle();
  if (!item) {
    log("warn", "store item not found", { itemId });
    return;
  }
  const reference = `stripe:${env}:store:${session.id}`;

  // Idempotency check via coin_transactions reference (for coin-reward items)
  // and a marker insert for perk/stock (any item).
  const { data: already } = await supabase
    .from("coin_transactions").select("id").eq("reference", reference).maybeSingle();
  if (already) {
    log("info", "store checkout already processed", { reference });
    return;
  }

  const coinReward = Number((item as any).coin_reward ?? 0);
  if (coinReward > 0) {
    const { error: creditErr } = await (supabase as any).rpc("credit_coin_transaction", {
      _user_id: userId,
      _amount: coinReward,
      _type: "stripe_purchase",
      _reference: reference,
    });
    if (creditErr) log("error", "store coin reward failed", { reference, err: creditErr.message });
  } else {
    // Still log a zero-amount ledger row so the idempotency check works.
    await supabase.from("coin_transactions").insert({
      user_id: userId, amount: 0, type: "store_purchase", reference,
    });
  }

  // Increment stock_sold
  await supabase.from("store_items")
    .update({ stock_sold: ((item as any).stock_sold ?? 0) + 1 })
    .eq("id", itemId);

  // Grant perks
  const perk = (item as any).perk_slug as string | null;
  if (perk?.startsWith("role:")) {
    const role = perk.slice(5).trim() as "admin" | "boss" | "dev" | "og_bot" | "user" | "vip";
    if (role) {
      const { error } = await (supabase as any)
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (error) log("error", "store perk role grant failed", { role, err: error.message });
    }
  }

  log("info", "store item fulfilled", { itemId, userId, coinReward, perk });
}

// ─── dispatch ──────────────────────────────────────────────────────────────
export async function handleEvent(event: { id: string; type: string; data: { object: any } }, env: StripeEnv) {
  log("info", "handling event", { eventId: event.id, type: event.type, env });
  switch (event.type) {
    case "checkout.session.completed":
    case "transaction.completed": {
      const session = event.data.object;
      const bundleId = session?.metadata?.bundleId as string | undefined;
      const kind = session?.metadata?.kind as string | undefined;
      if (kind === "track_unlock") await fulfilTrackUnlock(session, env);
      else if (bundleId?.startsWith("store:")) await fulfilStoreItemCheckout(session, env);
      else if (isVipBundle(bundleId)) await grantVipFromCheckout(session, env);
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
    case "charge.refunded":
      await handleChargeRefunded(event.data.object, env);
      break;
    case "refund.created":
    case "refund.updated":
    case "refund.failed":
    case "charge.refund.updated":
      await handleRefundEvent(event.data.object, env);
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
