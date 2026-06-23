import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import {
  findCoinPackByPriceId,
  findCoinPackByBundleId,
  isVipBundle,
  VIP_PLAN,
  CUSTOM_COIN_UNIT,
  applyPackOverride,
  parsePackOverride,
  packOverrideKey,
} from "@/lib/coin-packs";

type CheckoutSessionResult = { clientSecret: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCoinCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
      const pack = findCoinPackByPriceId(data.priceId);
      if (!pack) throw new Error("Unknown coin pack");
      if (data.environment !== "sandbox" && data.environment !== "live") {
        throw new Error("Invalid environment");
      }
      if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid returnUrl");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    const { userId, supabase } = context;
    try {
      const basePack = findCoinPackByPriceId(data.priceId)!;
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];

      // Read server-side admin override (label / desc / coins / price / bonus).
      // The override row is only writable via the set_site_content RPC, which
      // is gated to admin/dev — so trusting these values here is safe.
      let override = parsePackOverride(null);
      try {
        const { data: row } = await supabase
          .from("site_content")
          .select("value")
          .eq("key", packOverrideKey(basePack.bundleId))
          .maybeSingle();
        override = parsePackOverride(row?.value);
      } catch { /* override is best-effort; fall back to canonical pack */ }

      const pack = applyPackOverride(basePack, override);
      const priceChanged = pack.priceCents !== basePack.priceCents;

      // Best-effort email lookup for receipt + Customer linking.
      let email: string | undefined;
      try {
        const { data: prof } = await supabase
          .from("profiles").select("email").eq("id", userId).maybeSingle();
        email = (prof?.email as string | undefined) ?? undefined;
      } catch { /* email is optional */ }

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const productId = typeof stripePrice.product === "string"
        ? stripePrice.product
        : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);
      const productDescription = pack.label !== basePack.label
        ? `${pack.label} · ${pack.coins} OG Coins`
        : product.name;

      // When the admin has changed the price, we cannot reuse the catalog
      // price id (its unit_amount is fixed). Build a one-off price_data
      // line pointing at the same Stripe Product so receipts and the
      // dashboard still resolve the right product name.
      const lineItem = priceChanged
        ? {
            price_data: {
              currency: basePack.currency,
              unit_amount: pack.priceCents,
              product: productId,
            },
            quantity: 1,
          }
        : { price: stripePrice.id, quantity: 1 };

      const session = await stripe.checkout.sessions.create({
        line_items: [lineItem],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: {
          description: productDescription,
          metadata: {
            userId,
            bundleId: pack.bundleId,
            coins: String(pack.coins),
          },
        },
        metadata: {
          userId,
          bundleId: pack.bundleId,
          coins: String(pack.coins),
          environment: data.environment,
          ...(priceChanged ? { priceOverridden: "1" } : {}),
        },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("createCoinCheckoutSession failed", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createVipCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { returnUrl: string; environment: StripeEnv }) => {
      if (data.environment !== "sandbox" && data.environment !== "live") {
        throw new Error("Invalid environment");
      }
      if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid returnUrl");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    const { userId, supabase } = context;
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [VIP_PLAN.priceId] });
      if (!prices.data.length) throw new Error("VIP price not found");
      const stripePrice = prices.data[0];

      let email: string | undefined;
      try {
        const { data: prof } = await supabase
          .from("profiles").select("email").eq("id", userId).maybeSingle();
        email = (prof?.email as string | undefined) ?? undefined;
      } catch { /* email optional */ }

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: {
          userId,
          bundleId: VIP_PLAN.bundleId,
          environment: data.environment,
        },
        subscription_data: {
          metadata: {
            userId,
            bundleId: VIP_PLAN.bundleId,
          },
        },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("createVipCheckoutSession failed", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createCustomCoinCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { units: number; returnUrl: string; environment: StripeEnv }) => {
      if (!Number.isInteger(data.units)) throw new Error("Invalid units");
      if (data.units < CUSTOM_COIN_UNIT.minUnits || data.units > CUSTOM_COIN_UNIT.maxUnits) {
        throw new Error(`Units must be between ${CUSTOM_COIN_UNIT.minUnits} and ${CUSTOM_COIN_UNIT.maxUnits}`);
      }
      if (data.environment !== "sandbox" && data.environment !== "live") {
        throw new Error("Invalid environment");
      }
      if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid returnUrl");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    const { userId, supabase } = context;
    try {
      const stripe = createStripeClient(data.environment);
      const coins = data.units * CUSTOM_COIN_UNIT.coins;


      let email: string | undefined;
      try {
        const { data: prof } = await supabase
          .from("profiles").select("email").eq("id", userId).maybeSingle();
        email = (prof?.email as string | undefined) ?? undefined;
      } catch { /* optional */ }

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const description = `${coins} OG Coins (Custom)`;
      const session = await stripe.checkout.sessions.create({
        line_items: [{
          // Use quantity = units so Stripe Checkout shows the line as
          // "<units> × £0.99" (per-unit pricing) instead of a single
          // opaque amount. The total still equals units * priceCents.
          price_data: {
            currency: "gbp",
            product_data: {
              name: `${CUSTOM_COIN_UNIT.coins}-coin top-up`,
              description: `Each unit = ${CUSTOM_COIN_UNIT.coins} OG Coins`,
            },
            unit_amount: CUSTOM_COIN_UNIT.priceCents,
          },
          quantity: data.units,
        }],

        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: {
          description,
          metadata: {
            userId,
            bundleId: "coins_custom",
            coins: String(coins),
          },
        },
        metadata: {
          userId,
          bundleId: "coins_custom",
          coins: String(coins),
          environment: data.environment,
        },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("createCustomCoinCheckoutSession failed", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

// -------------------------------------------------------------------------
// Reconcile: when the webhook hasn't credited yet (delivery delay, missed
// retry, etc.), the return page calls this with the Stripe session_id to
// credit coins on-demand. Idempotent: uses the same `reference` key as
// the webhook so it can run safely alongside it.
// -------------------------------------------------------------------------

type ReconcileResult =
  | { status: "credited"; coins: number; balance: number }
  | { status: "already_credited"; balance: number }
  | { status: "vip_granted" }
  | { status: "pending"; reason: string }
  | { error: string };

export const reconcileCoinSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(data.sessionId)) throw new Error("Invalid sessionId");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    return data;
  })
  .handler(async ({ data, context }): Promise<ReconcileResult> => {
    const { userId } = context;
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);

      const meta = (session.metadata ?? {}) as Record<string, string | undefined>;
      if (meta.userId !== userId) {
        return { error: "Session does not belong to this user" };
      }
      if (session.status !== "complete" || (session.payment_status && session.payment_status !== "paid" && session.payment_status !== "no_payment_required")) {
        return { status: "pending", reason: session.payment_status ?? session.status ?? "unknown" };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const bundleId = meta.bundleId;

      // VIP subscription path
      if (bundleId && isVipBundle(bundleId)) {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "vip" }, { onConflict: "user_id,role" });
        if (error) return { error: error.message };
        return { status: "vip_granted" };
      }

      const metaCoins = meta.coins ? Number(meta.coins) : 0;
      const pack = bundleId ? findCoinPackByBundleId(bundleId) : null;
      const coins = Number.isFinite(metaCoins) && metaCoins > 0 ? metaCoins : (pack?.coins ?? 0);
      if (!coins || coins <= 0) return { error: "Could not determine coin amount" };

      const reference = `stripe:${data.environment}:${session.id}`;
      const { data: existing } = await supabaseAdmin
        .from("coin_transactions")
        .select("id")
        .eq("reference", reference)
        .maybeSingle();

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("coin_balance").eq("id", userId).maybeSingle();
      if (!profile) return { error: "Profile not found" };

      if (existing) {
        return { status: "already_credited", balance: profile.coin_balance ?? 0 };
      }

      const newBalance = (profile.coin_balance ?? 0) + coins;
      const { error: updErr } = await supabaseAdmin
        .from("profiles").update({ coin_balance: newBalance }).eq("id", userId);
      if (updErr) return { error: updErr.message };

      const { error: txErr } = await supabaseAdmin.from("coin_transactions").insert({
        user_id: userId,
        amount: coins,
        type: "stripe_purchase",
        reference,
      });
      if (txErr) {
        // Race with webhook: another writer inserted the same reference.
        // Treat as success — the balance update already landed.
        if (txErr.code !== "23505") console.error("reconcile tx insert failed", txErr);
      }

      return { status: "credited", coins, balance: newBalance };
    } catch (error) {
      console.error("reconcileCoinSession failed", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

// -------------------------------------------------------------------------
// Purchase history: any user can see their own coin/VIP transactions.
// -------------------------------------------------------------------------

export type StripePurchaseDetails = {
  amountPaid: number;
  currency: string;
  refundedAmount: number;
  refunded: boolean;
  partiallyRefunded: boolean;
};

export type PurchaseRow = {
  id: string;
  amount: number;
  type: string;
  reference: string | null;
  created_at: string;
  stripe?: StripePurchaseDetails | null;
};

const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"]);
const THREE_DECIMAL = new Set(["bhd","jod","kwd","omr","tnd"]);
function toMajorUnit(amount: number, currency: string) {
  const c = (currency ?? "").toLowerCase();
  if (ZERO_DECIMAL.has(c)) return amount;
  if (THREE_DECIMAL.has(c)) return amount / 1000;
  return amount / 100;
}

function parseStripeRef(ref: string | null): { env: StripeEnv; sessionId: string } | null {
  if (!ref) return null;
  const m = /^stripe:(sandbox|live):(cs_(?:test|live)_[A-Za-z0-9]+)$/.exec(ref);
  return m ? { env: m[1] as StripeEnv, sessionId: m[2] } : null;
}

async function fetchStripeDetails(
  sessionId: string,
  env: StripeEnv,
  expectedUserId: string,
): Promise<StripePurchaseDetails | null> {
  try {
    const stripe = createStripeClient(env);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "payment_intent.latest_charge"],
    });
    if ((session.metadata?.userId ?? "") !== expectedUserId) return null;
    const charge: any = (session.payment_intent as any)?.latest_charge;
    if (!charge) return null;
    const currency = (charge.currency ?? session.currency ?? "usd") as string;
    const amountPaid = toMajorUnit(charge.amount ?? 0, currency);
    const refundedRaw = charge.amount_refunded ?? 0;
    const refundedAmount = toMajorUnit(refundedRaw, currency);
    const refunded = !!charge.refunded || refundedRaw >= (charge.amount ?? 0);
    return {
      amountPaid,
      currency,
      refundedAmount,
      refunded,
      partiallyRefunded: refundedRaw > 0 && !refunded,
    };
  } catch (e) {
    console.error("fetchStripeDetails failed", e);
    return null;
  }
}

export const getCoinPurchaseHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PurchaseRow[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("coin_transactions")
      .select("id, amount, type, reference, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PurchaseRow[];

    const stripeRows = rows
      .filter((r) => r.type === "stripe_purchase" && r.amount > 0 && parseStripeRef(r.reference))
      .slice(0, 30);

    const enriched = await Promise.all(
      stripeRows.map(async (r) => {
        const ref = parseStripeRef(r.reference)!;
        const details = await fetchStripeDetails(ref.sessionId, ref.env, userId);
        return [r.id, details] as const;
      }),
    );
    const detailMap = new Map(enriched);
    return rows.map((r) =>
      detailMap.has(r.id) ? { ...r, stripe: detailMap.get(r.id) ?? null } : r,
    );
  });

// -------------------------------------------------------------------------
// Receipt link
// -------------------------------------------------------------------------

type ReceiptResult = { url: string } | { error: string };

export const getStripeReceiptUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(data.sessionId)) throw new Error("Invalid sessionId");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    return data;
  })
  .handler(async ({ data, context }): Promise<ReceiptResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["payment_intent", "payment_intent.latest_charge", "invoice"],
      });
      if ((session.metadata?.userId ?? "") !== context.userId) {
        return { error: "Not your session" };
      }
      const charge = (session.payment_intent as any)?.latest_charge;
      if (charge?.receipt_url) return { url: charge.receipt_url };
      const invoice = session.invoice as any;
      if (invoice?.hosted_invoice_url) return { url: invoice.hosted_invoice_url };
      return { error: "No receipt available yet" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// -------------------------------------------------------------------------
// VIP-only instant refund. Issues a full Stripe refund and reverses the
// credited coins on the caller's balance. Idempotent if charge is already
// refunded.
// -------------------------------------------------------------------------

type RefundResult =
  | { status: "refunded"; refundedAmount: number; currency: string; newBalance: number }
  | { status: "already_refunded"; refundedAmount: number; currency: string }
  | { error: string };

export const refundCoinPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(data.sessionId)) throw new Error("Invalid sessionId");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    return data;
  })
  .handler(async ({ data, context }): Promise<RefundResult> => {
    const { supabase, userId } = context;
    try {
      const { data: isVip, error: roleErr } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "vip",
      });
      if (roleErr) return { error: roleErr.message };
      if (!isVip) return { error: "VIP membership required for instant refunds" };

      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["payment_intent", "payment_intent.latest_charge"],
      });
      if ((session.metadata?.userId ?? "") !== userId) {
        return { error: "Not your session" };
      }
      const pi: any = session.payment_intent;
      const charge: any = pi?.latest_charge;
      if (!pi?.id || !charge) return { error: "No charge to refund" };

      const currency = (charge.currency ?? "usd") as string;
      const reference = `stripe:${data.environment}:${session.id}`;

      if (charge.refunded || (charge.amount_refunded ?? 0) >= (charge.amount ?? 0)) {
        return {
          status: "already_refunded",
          refundedAmount: toMajorUnit(charge.amount_refunded ?? charge.amount ?? 0, currency),
          currency,
        };
      }

      const refund = await stripe.refunds.create({ payment_intent: pi.id });
      const refundedAmount = toMajorUnit(refund.amount ?? 0, currency);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const coinsToReverse = Math.max(0, Number(session.metadata?.coins ?? 0)) || 0;
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("coin_balance").eq("id", userId).maybeSingle();
      const current = prof?.coin_balance ?? 0;
      const newBalance = Math.max(0, current - coinsToReverse);
      if (coinsToReverse > 0) {
        await supabaseAdmin.from("profiles").update({ coin_balance: newBalance }).eq("id", userId);
        await supabaseAdmin.from("coin_transactions").insert({
          user_id: userId,
          amount: -coinsToReverse,
          type: "refund",
          reference,
        });
      }

      return { status: "refunded", refundedAmount, currency, newBalance };
    } catch (error) {
      console.error("refundCoinPurchase failed", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

// ─── Billing portal (Manage my subscription) ──────────────────────────────
type PortalResult = { url: string } | { error: string };

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { returnUrl: string; environment: StripeEnv }) => {
      if (data.environment !== "sandbox" && data.environment !== "live") {
        throw new Error("Invalid environment");
      }
      if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid returnUrl");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { userId, supabase } = context;
    try {
      // Prefer the customer id from the latest synced subscription row.
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const stripe = createStripeClient(data.environment);
      let customerId = (sub?.stripe_customer_id as string | undefined) ?? null;

      // Fallback: search Stripe by metadata.userId (covers users who subscribed
      // before the subscriptions table was wired up).
      if (!customerId) {
        const found = await stripe.customers.search({
          query: `metadata['userId']:'${userId}'`,
          limit: 1,
        });
        customerId = found.data[0]?.id ?? null;
      }
      if (!customerId) return { error: "No active subscription found." };

      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: data.returnUrl,
      });
      return { url: portal.url };
    } catch (error) {
      console.error("createBillingPortalSession failed", error);
      return { error: getStripeErrorMessage(error) };
    }
  });


