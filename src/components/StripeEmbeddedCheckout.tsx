import { useCallback, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { AlertTriangle, RotateCw } from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCoinCheckoutSession, createVipCheckoutSession } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";

interface Props {
  priceId?: string;
  returnUrl: string;
  type?: "coins" | "vip";
}

export function StripeEmbeddedCheckoutInline({ priceId, returnUrl, type = "coins" }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    try {
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't start checkout";
      setError(msg);
      throw e;
    }
  }, [priceId, returnUrl, type, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-3 text-sm font-semibold text-foreground">Checkout couldn't start</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Your card was not charged. Tap retry below, or come back in a moment.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setError(null);
            setAttempt((a) => a + 1);
          }}
        >
          <RotateCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div id="checkout" key={attempt}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
