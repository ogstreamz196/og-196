import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStripe } from "@/lib/stripe";

/** Mounts Stripe's embedded checkout for a session client secret. */
export function StripeCheckoutDialog({ clientSecret, onClose }: { clientSecret: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientSecret) return;
    let destroyed = false;
    let checkout: { destroy: () => void; mount: (el: HTMLElement) => void } | null = null;
    setError(null);
    setReady(false);
    (async () => {
      try {
        const stripe = await getStripe();
        if (!stripe) throw new Error("Payments unavailable");
        const c = await stripe.createEmbeddedCheckoutPage({ fetchClientSecret: async () => clientSecret });
        if (destroyed) return c.destroy();
        checkout = c;
        const mountWhenReady = () => {
          if (destroyed) return;
          if (ref.current) { c.mount(ref.current); setReady(true); }
          else requestAnimationFrame(mountWhenReady);
        };
        mountWhenReady();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed to load");
      }
    })();
    return () => { destroyed = true; checkout?.destroy(); };
  }, [clientSecret]);

  return (
    <Dialog open={!!clientSecret} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto p-0">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle>Secure checkout</DialogTitle>
        </DialogHeader>
        <div className="min-h-[300px] p-2">
          {error ? <p className="p-6 text-center text-sm text-destructive">{error}</p> : null}
          {!ready && !error ? <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : null}
          <div ref={ref} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
