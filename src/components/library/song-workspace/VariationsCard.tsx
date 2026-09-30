import { useState } from "react";
import { Loader2, Wand2, Coins, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Variation } from "./types";

interface VariationsCardProps {
  variations: Variation[];
  variationCost: number;
  busyVariation: string | null;
  balance: number;
  onRevealOne: (id: string) => void;
}

const STUDIO_STEPS = [
  "Re-cutting the vocal take…",
  "Switching up the flow and cadence…",
  "Mixing the new master…",
];

/**
 * "Remake this track" card. Presented to the user as a discounted fresh studio
 * remake; under the hood it unlocks the alt-take already rendered for the song.
 */
export function VariationsCard({
  variations,
  variationCost,
  busyVariation,
  balance,
  onRevealOne,
}: VariationsCardProps) {
  const [step, setStep] = useState(0);
  const locked = variations.filter((v) => !v.revealed);
  const remade = variations.filter((v) => v.revealed);
  if (variations.length === 0) return null;

  const next = locked[0];
  const busy = !!next && busyVariation === next.id;
  const affordable = balance >= variationCost;

  const startRemake = () => {
    if (!next) return;
    setStep(0);
    const t1 = window.setTimeout(() => setStep(1), 700);
    const t2 = window.setTimeout(() => setStep(2), 1400);
    Promise.resolve(onRevealOne(next.id))
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        setStep(0);
      });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wand2 className="h-4 w-4 text-primary" /> Want a different vibe?
        </CardTitle>
        <CardDescription>
          Remake this track with a fresh vocal take, new flow and a different arrangement — same
          story, brand new sound. Only {variationCost} coin{variationCost === 1 ? "" : "s"}, half
          the price of a new track.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {remade.length > 0 && (
          <ul className="space-y-2" aria-label="Remade versions">
            {remade.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{v.title || "Studio remake"}</div>
                  <div className="text-xs text-muted-foreground">In your library</div>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  <Check className="h-3 w-3" aria-hidden="true" /> Remade
                </span>
              </li>
            ))}
          </ul>
        )}

        {next && (
          <>
            {busy && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {STUDIO_STEPS[step]}
              </p>
            )}
            {!busy && !affordable && (
              <p className="text-xs text-amber-200/80">
                You need {variationCost - balance} more coin
                {variationCost - balance === 1 ? "" : "s"} · Balance: {balance}
              </p>
            )}
            <Button
              className="w-full gap-2"
              onClick={startRemake}
              disabled={busy || !affordable}
              aria-live="polite"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Coins className="h-4 w-4" aria-hidden="true" />
              )}
              {busy ? "Remaking your track…" : `Remake track · ${variationCost} coins`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
