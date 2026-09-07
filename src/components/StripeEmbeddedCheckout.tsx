import { useCallback, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { AlertTriangle, Loader2, Lock, RotateCw, CreditCard } from "lucide-react";
import { arePaymentsEnabled, getStripe, getStripeEnvironment } from "@/lib/stripe";
import {
  createCoinCheckoutSession,
  createVipCheckoutSession,
  createCustomCoinCheckoutSession,
} from "@/lib/payments.functions";
import { createStoreItemCheckoutSession } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";

interface Props {
  priceId?: string;
  returnUrl: string;
  type?: "coins" | "vip" | "custom" | "store_item";
  customUnits?: number;
  storeItemId?: string;
}

export function StripeEmbeddedCheckoutInline({
  priceId, returnUrl, type = "coins", customUnits, storeItemId,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    try {
      const result =
        type === "vip"
          ? await createVipCheckoutSession({
              data: { returnUrl, environment: getStripeEnvironment() },
            })
          : type === "custom"
          ? await createCustomCoinCheckoutSession({
              data: { units: customUnits!, returnUrl, environment: getStripeEnvironment() },
            })
          : type === "store_item"
          ? await createStoreItemCheckoutSession({
              data: { itemId: storeItemId!, returnUrl, environment: getStripeEnvironment() },
            })
          : await createCoinCheckoutSession({
              data: { priceId: priceId!, returnUrl, environment: getStripeEnvironment() },
            });
      if ("error" in result) throw new Error(result.error);
      if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
      setTimeout(() => setReady(true), 900);
      return result.clientSecret;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't start checkout";
      setError(msg);
      throw e;
    }
  }, [priceId, returnUrl, type, customUnits, storeItemId, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center"
      >
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
            setReady(false);
            setAttempt((a) => a + 1);
          }}
        >
          <RotateCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div id="checkout" key={attempt} className="relative min-h-[420px]">
      {!ready && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-10 grid place-items-center rounded-2xl border border-border bg-background/70 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-coin" />
            <p className="text-sm font-semibold">Starting secure checkout…</p>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Lock className="h-3 w-3" /> Encrypted by Stripe
            </p>
          </div>
        </div>
      )}
      <EmbeddedCheckoutProvider
        stripe={getStripe()}
        options={{
          fetchClientSecret,
          onComplete: () => setReady(true),
        }}
      >
        <div onLoad={() => setReady(true)}>
          <EmbeddedCheckout />
        </div>
      </EmbeddedCheckoutProvider>
    </div>
  );
}
