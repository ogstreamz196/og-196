import { Coins, Download, Music2, Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
  cost: number;
  royalty: number;
  balance: number;
  songTitle?: string | null;
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
}: Props) {
  const burnt = Math.max(0, cost - royalty);
  const canAfford = balance >= cost;
  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Unlock the full track
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {songTitle ? <span className="font-medium text-foreground">{songTitle}</span> : "This track"} — confirm the coin
            spend to unlock and download the full studio version.
          </DialogDescription>
        </DialogHeader>

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

          {!canAfford && (
            <p className="text-xs text-destructive">
              Not enough coins — top up in the Store to unlock.
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
      </DialogContent>
    </Dialog>
  );
}
