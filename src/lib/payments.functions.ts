import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import {
  findCoinPackByPriceId,
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

export type PurchaseRow = {
  id: string;
  amount: number;
  type: string;
  reference: string | null;
  created_at: string;
};

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
    return (data ?? []) as PurchaseRow[];
  });
