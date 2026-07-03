import { useMemo } from "react";
import { Sparkles, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { POOLS } from "@/lib/library-utils";
import { cn } from "@/lib/utils";

/**
 * Unified style composer — replaces the separate Genre / Mood / Theme cards.
 *
 * Users can tap predefined chips (Genre, Mood, Theme) to append tags to the
 * free-form style description, OR type their own text. Chips already present
 * in the description are rendered as "active" and clicking them removes the
 * exact tag from the text.
 */
interface Props {
  value: string;
  onChange: (v: string) => void;
}

const SEP = " · ";

const CHIP_GROUPS: { label: string; emoji: string; accent: string; items: string[] }[] = [
  { label: "Genre", emoji: "🎧", accent: "text-fuchsia-300", items: POOLS.genre },
  { label: "Mood", emoji: "✨", accent: "text-amber-300", items: POOLS.mood },
  { label: "Theme", emoji: "💭", accent: "text-rose-300", items: POOLS.theme },
];

function splitTags(text: string): string[] {
  return text
    .split(/[·,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function StyleComposer({ value, onChange }: Props) {
  const active = useMemo(() => {
    const set = new Set<string>();
    for (const t of splitTags(value)) set.add(t.toLowerCase());
    return set;
  }, [value]);

  function toggle(tag: string) {
    if (active.has(tag.toLowerCase())) {
      const next = splitTags(value)
        .filter((t) => t.toLowerCase() !== tag.toLowerCase())
        .join(SEP);
      onChange(next);
    } else {
      const trimmed = value.trim();
      const next = trimmed ? `${trimmed}${SEP}${tag}` : tag;
      onChange(next);
    }
  }

  const selectedCount = active.size;

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
              Tap chips to add · or type your own vibe
              {selectedCount > 0 && (
                <span className="ml-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200">
                  {selectedCount} picked
                </span>
              )}
            </div>
          </div>
        </div>

        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Afrobeats · Happy & Upbeat · Summer nights — or type anything (jazzy piano, half-time drums, dreamy synths…)"
          rows={3}
          className="min-h-[88px] resize-y rounded-xl border-white/10 bg-background/60 text-base leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-fuchsia-400/60 focus-visible:ring-2 focus-visible:ring-fuchsia-400/30"
        />

        <div className="space-y-3">
          {CHIP_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <div
                className={cn(
                  "font-bungee text-xs uppercase tracking-wider sm:text-sm",
                  group.accent,
                )}
              >
                {group.emoji} {group.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((chip) => {
                  const isActive = active.has(chip.toLowerCase());
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggle(chip)}
                      aria-pressed={isActive}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5",
                        isActive
                          ? "border-fuchsia-400 bg-fuchsia-500/25 text-fuchsia-100 shadow-[0_0_18px_-6px_theme(colors.fuchsia.400)]"
                          : "border-white/10 bg-white/[0.04] text-foreground/85 hover:border-white/25 hover:bg-white/10",
                      )}
                    >
                      {chip}
                      {isActive && <X className="h-3 w-3" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
