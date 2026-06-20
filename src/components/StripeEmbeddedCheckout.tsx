import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCoinCheckoutSession, createVipCheckoutSession } from "@/lib/payments.functions";

interface Props {
  priceId?: string;
  returnUrl: string;
  type?: "coins" | "vip";
}

export function StripeEmbeddedCheckoutInline({ priceId, returnUrl, type = "coins" }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = type === "vip"
      ? await createVipCheckoutSession({
          data: { returnUrl, environment: getStripeEnvironment() },
        })
      : await createCoinCheckoutSession({
          data: { priceId: priceId!, returnUrl, environment: getStripeEnvironment() },
        });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
