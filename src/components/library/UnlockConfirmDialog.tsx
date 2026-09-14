import { useState } from "react";
import { Coins, Download, Music2, Sparkles, Loader2, CreditCard, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StripeEmbeddedCheckoutInline } from "@/components/StripeEmbeddedCheckout";
import { arePaymentsEnabled } from "@/lib/stripe";

/** One-off card price shown in the UI. Must match TRACK_UNLOCK_PENCE server-side. */
const CARD_PRICE_LABEL = "99p";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
  cost: number;
  royalty: number;
  balance: number;
  songTitle?: string | null;
  /** Enables the "pay by card instead" option for this track. */
  songId?: string;
};

export function UnlockConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  busy,
  cost,
  royalty,
  balance,
  songTitle,
  songId,
}: Props) {
  const [payByCard, setPayByCard] = useState(false);
  const burnt = Math.max(0, cost - royalty);
  const canAfford = balance >= cost;
  const cardAvailable = !!songId && arePaymentsEnabled();

  const returnUrl =
    typeof window === "undefined"
      ? ""
      : (() => {
          const url = new URL(window.location.href);
          url.searchParams.set("track_unlock", "1");
          url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
          return decodeURIComponent(url.toString());
        })();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        if (!v) setPayByCard(false);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Unlock the full track
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {songTitle ? <span className="font-medium text-foreground">{songTitle}</span> : "This track"} —{" "}
            {payByCard
              ? `pay ${CARD_PRICE_LABEL} once to unlock and download the full studio version.`
              : "choose how you'd like to pay for the full studio version."}
          </DialogDescription>
        </DialogHeader>

        {payByCard ? (
          <div className="space-y-3">
            <StripeEmbeddedCheckoutInline
              type="track_unlock"
              songId={songId}
              returnUrl={returnUrl}
            />
            <Button variant="ghost" className="w-full" onClick={() => setPayByCard(false)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to coin payment
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Music2 className="h-4 w-4 text-muted-foreground" />
                    <span>Preview → Full download</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                    <Coins className="h-4 w-4" /> {cost} coins
                  </div>
                </div>
                <ol className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <li>1. You've been enjoying the short preview.</li>
                  <li>2. Confirm to spend <strong className="text-foreground">{cost} OG coins</strong> from your balance.</li>
                  <li>3. {royalty > 0 ? (
                    <>
                      <strong className="text-foreground">{burnt}</strong> burnt · <strong className="text-foreground">{royalty}</strong> royalty
                      to the original creator.
                    </>
                  ) : (
                    <>All {cost} coins burnt to unlock your track.</>
                  )}</li>
                  <li>4. Full HQ MP3 downloads instantly — yours to keep.</li>
                </ol>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <span className="text-muted-foreground">Your balance</span>
                <span className="font-semibold">
                  {balance} → <span className={canAfford ? "text-primary" : "text-destructive"}>{balance - cost}</span>
                </span>
              </div>

              {cardAvailable && (
                <button
                  type="button"
                  onClick={() => setPayByCard(true)}
                  disabled={busy}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-3 py-3 text-left transition hover:bg-primary/10 disabled:opacity-50"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Pay {CARD_PRICE_LABEL} by card instead
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    No coins needed
                  </span>
                </button>
              )}

              {!canAfford && (
                <p className="text-xs text-destructive">
                  Not enough coins — pay {CARD_PRICE_LABEL} by card above, or top up in the Store.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={onConfirm} disabled={busy || !canAfford} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {busy ? "Unlocking…" : `Confirm · ${cost} coins`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
