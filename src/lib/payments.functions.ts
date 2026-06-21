import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import { findCoinPackByPriceId, VIP_PLAN, CUSTOM_COIN_UNIT } from "@/lib/coin-packs";

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
      const pack = findCoinPackByPriceId(data.priceId)!;
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];

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

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: {
          description: product.name,
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
      const amount = data.units * CUSTOM_COIN_UNIT.priceCents;

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
          price_data: {
            currency: "gbp",
            product_data: { name: description },
            unit_amount: amount,
          },
          quantity: 1,
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
