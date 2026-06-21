import { Loader2, Sparkles, Coins, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Variation } from "./types";

interface VariationsCardProps {
  variations: Variation[];
  variationCost: number;
  basket: Set<string>;
  busyVariation: string | null;
  checkingOut: boolean;
  balance: number;
  onToggleBasket: (id: string) => void;
  onRevealOne: (id: string) => void;
  onClearBasket: () => void;
  onCheckoutBasket: () => void;
}

/** Locked alt-takes list with reveal + basket checkout. */
export function VariationsCard({
  variations,
  variationCost,
  basket,
  busyVariation,
  checkingOut,
  balance,
  onToggleBasket,
  onRevealOne,
  onClearBasket,
  onCheckoutBasket,
}: VariationsCardProps) {
  if (variations.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-4 w-4 text-primary" /> Alternate takes
        </CardTitle>
        <CardDescription>
          Same lyrics, different sample. Reveal each for {variationCost} coin{variationCost === 1 ? "" : "s"} (half of a fresh generation), or basket them and check out with OG Coins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-2" aria-label="Alternate takes">
          {variations.map((v) => {
            const inBasket = basket.has(v.id);
            const busy = busyVariation === v.id;
            return (
              <li key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {v.revealed ? (v.title || "Alt take") : "Locked alt take"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {v.revealed ? "Revealed" : `${variationCost} coins to reveal`}
                  </div>
                </div>
                {v.revealed ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Unlocked</span>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={inBasket ? "default" : "outline"}
                      onClick={() => onToggleBasket(v.id)}
                      disabled={busy || checkingOut}
                      aria-pressed={inBasket}
                    >
                      {inBasket ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Coins className="h-3.5 w-3.5" aria-hidden="true" />}
                      {inBasket ? "In basket" : "Add"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onRevealOne(v.id)}
                      disabled={busy || checkingOut || balance < variationCost}
                    >
                      {busy
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                      Reveal
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {basket.size > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="text-sm">
              <b>{basket.size}</b> in basket · <b>{basket.size * variationCost}</b> coins total
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={onClearBasket} disabled={checkingOut}>
                Clear
              </Button>
              <Button
                size="sm"
                onClick={onCheckoutBasket}
                disabled={checkingOut || balance < basket.size * variationCost}
              >
                {checkingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                Checkout
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
