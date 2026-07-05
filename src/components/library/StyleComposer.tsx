import { Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

/**
 * Unified style composer — free-form vibe description with a handful of
 * example phrases underneath so users know what "good" looks like without
 * being overwhelmed by long chip lists.
 */
interface Props {
  value: string;
  onChange: (v: string) => void;
}

const EXAMPLES: string[] = [
  "Afrobeats · happy & upbeat · summer nights",
  "Drill · moody · late-night city drive",
  "Acoustic ballad · heartfelt · rainy Sunday",
  "Amapiano · dreamy · rooftop sunset",
];

export function StyleComposer({ value, onChange }: Props) {
  return (
    <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-card/70 p-5 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.55)] ring-1 ring-white/5 backdrop-blur-xl sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-fuchsia-500/30 via-amber-500/20 to-rose-500/20 opacity-80 blur-3xl"
      />
      <div className="relative space-y-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/20 text-fuchsia-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="font-bungee text-xl uppercase sm:text-2xl">✨ Style</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Describe the vibe — genre, mood, setting, instruments
            </div>
          </div>
        </div>

        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Afrobeats · happy & upbeat · summer nights — or type anything (jazzy piano, half-time drums, dreamy synths…)"
          rows={3}
          className="min-h-[88px] resize-y rounded-xl border-white/10 bg-background/60 text-base leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-fuchsia-400/60 focus-visible:ring-2 focus-visible:ring-fuchsia-400/30"
        />

        <div className="space-y-2">
          <div className="font-bungee text-xs uppercase tracking-wider text-fuchsia-300/80">
            💡 Examples
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {EXAMPLES.map((ex) => (
              <li key={ex} className="flex gap-2">
                <span aria-hidden className="text-fuchsia-400/70">–</span>
                <span className="italic">{ex}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

