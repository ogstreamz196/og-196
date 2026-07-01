import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionDividerProps {
  /** Optional id applied to the heading — used for `aria-labelledby` on parent sections. */
  id?: string;
  /** Short uppercase label shown inside the chip (e.g. "Step 1", "Or upgrade"). */
  eyebrow: string;
  /** Section title rendered as an `<h2>`. */
  title: string;
  /** Optional icon rendered inside the eyebrow chip. */
  icon?: ReactNode;
  /** Optional trailing widget (badge, link) aligned next to the title. */
  action?: ReactNode;
  /** Visual accent: `default` uses border neutrals, `coin` uses the coin/gold theme. */
  tone?: "default" | "coin";
}

/**
 * Section divider used across the Buy Coins page to separate Custom → VIP → Bundles
 * blocks. Renders a gradient hairline with a labeled chip, then the section heading
 * (with an optional trailing action). Font size is clamp-scaled so long titles never
 * overflow on mobile.
 */
export function SectionDivider({
  id,
  eyebrow,
  title,
  icon,
  action,
  tone = "default",
}: SectionDividerProps) {
  const accent = tone === "coin" ? "via-coin/40" : "via-border";
  const chipTone =
    tone === "coin"
      ? "border-coin/40 bg-coin/10 text-coin"
      : "border-border bg-background/60 text-muted-foreground";

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <span
          className={cn("h-px flex-1 bg-gradient-to-r from-transparent to-transparent", accent)}
          aria-hidden
        />
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] sm:gap-1.5 sm:px-3 sm:text-[10px] sm:tracking-[0.22em]",
            chipTone,
          )}
        >
          {icon}
          {eyebrow}
        </span>
        <span
          className={cn("h-px flex-1 bg-gradient-to-r from-transparent to-transparent", accent)}
          aria-hidden
        />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 sm:mt-3">
        <h2
          id={id}
          className="font-display font-black tracking-tight text-foreground [font-size:clamp(1.125rem,5vw,1.5rem)] leading-tight"
        >
          {title}
        </h2>
        {action}
      </div>
    </div>
  );
}

export default SectionDivider;
