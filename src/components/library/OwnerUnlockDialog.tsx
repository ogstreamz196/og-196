import { useEffect, useState } from "react";
import { Coins, Loader2, LockKeyhole, Sparkles, Layers } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string;
  songTitle?: string | null;
  balance: number;
  singleCost: number;
  /** Extra coins charged for revealing + unlocking the hidden second take. */
  secondTakeCost: number;
  busy?: boolean;
  /** Called with `bundle_both` once the user picks an option. */
  onConfirm: (bundleBoth: boolean) => void;
};

/**
 * Owner-facing padlock dialog: unlock the full master alone, or bundle the
 * hidden second take from the same generation for a few coins more.
 * Community (non-owner) downloads keep their own 3-coin royalty flow.
 */
export function OwnerUnlockDialog({
  open,
  onOpenChange,
  songId,
  songTitle,
  balance,
  singleCost,
  secondTakeCost,
  busy,
  onConfirm,
}: Props) {
  const [hasSecondTake, setHasSecondTake] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: self } = await supabase
        .from("songs")
        .select("suno_task_id")
        .eq("id", songId)
        .maybeSingle();
      const task = (self as { suno_task_id?: string | null } | null)?.suno_task_id;
      if (!task) {
        if (!cancelled) setHasSecondTake(false);
        return;
      }
      const { data: sibs } = await supabase
        .from("songs")
        .select("id")
        .eq("suno_task_id", task)
        .eq("is_variation", true)
        .eq("revealed", false)
        .neq("id", songId)
        .limit(1);
      if (!cancelled) setHasSecondTake((sibs ?? []).length > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, songId]);

  const bundleCost = singleCost + secondTakeCost;

  return (
    <Dialog open={open} onOpenChange={(v) => (busy ? null : onOpenChange(v))}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <LockKeyhole className="h-5 w-5 text-primary" /> Unlock this track
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {songTitle ? (
              <span className="font-medium text-foreground">{songTitle}</span>
            ) : (
              "This track"
            )}{" "}
            — unlock the full studio version to play it end to end and download it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onConfirm(false)}
            disabled={busy || balance < singleCost}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left transition",
              "hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15">
                <Sparkles className="h-5 w-5 text-primary" />
              </span>
              <span>
                <span className="block text-sm font-bold">Unlock full version</span>
                <span className="block text-xs text-muted-foreground">
                  Full-length playback and HQ download
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-lg font-black text-primary">
              <Coins className="h-4 w-4" /> {singleCost}
            </span>
          </button>

          {hasSecondTake && (
            <button
              type="button"
              onClick={() => onConfirm(true)}
              disabled={busy || balance < bundleCost}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-amber-400/30 bg-amber-500/5 p-4 text-left transition",
                "hover:border-amber-400 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-500/15">
                  <Layers className="h-5 w-5 text-amber-300" />
                </span>
                <span>
                  <span className="block text-sm font-bold">Unlock both versions</span>
                  <span className="block text-xs text-muted-foreground">
                    Adds the second take — a different vocal and arrangement
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-lg font-black text-amber-300">
                <Coins className="h-4 w-4" /> {bundleCost}
              </span>
            </button>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">Your balance</span>
            <span className="font-semibold">{balance} coins</span>
          </div>

          {balance < singleCost && (
            <p className="text-center text-xs text-destructive">
              Not enough coins — top up in the Store or earn some in Battle Zone.
            </p>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
