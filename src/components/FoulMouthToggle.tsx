import { cn } from "@/lib/utils";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";

export interface FoulMouthToggleProps {
  /** Disable interaction while an upstream action is running (e.g. generation). */
  disabled?: boolean;
  /** Kept for API compatibility — the large reminder banner was removed to keep the toggle compact. */
  showReminder?: boolean;
  className?: string;
}

/**
 * Profile-backed OG Foul Mouth toggle — a compact inline switch.
 *
 * Single source of truth — import this component everywhere instead of
 * recreating the markup. Uses `useFoulMouth` / `useSetFoulMouth` so the
 * value is persisted on the user profile and shared across pages.
 *
 * The control is intentionally small: a pill containing a mini switch and
 * the label "foul mouth mode", which only reads as active when turned on.
 */
export function FoulMouthToggle({
  disabled = false,
  showReminder: _showReminder = true,
  className,
}: FoulMouthToggleProps) {
  const { foulMouth } = useFoulMouth();
  const mutation = useSetFoulMouth();
  const saving = mutation.isPending;
  const locked = disabled;

  const toggle = () => {
    if (locked) return;
    mutation.mutate(!foulMouth);
  };

  return (
    <div className={cn("flex items-center", className)}>
      <button
        id="foul-mouth-toggle"
        type="button"
        role="switch"
        aria-pressed={foulMouth}
        aria-checked={foulMouth}
        aria-label="OG Foul Mouth — explicit lyrics mode"
        aria-describedby="foul-mouth-status"
        aria-disabled={locked || saving}
        onClick={toggle}
        disabled={locked}
        style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          foulMouth
            ? "border-destructive bg-destructive/15 shadow-[0_0_18px_-6px_oklch(0.62_0.22_25_/_0.7)]"
            : "border-white/15 bg-white/[0.04] hover:border-white/25",
        )}
      >
        {/* Mini switch */}
        <span
          aria-hidden="true"
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
            foulMouth ? "border-destructive bg-destructive" : "border-white/25 bg-white/10",
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full shadow-md transition-all",
              foulMouth ? "left-[calc(100%-1.05rem)] bg-white" : "left-0.5 bg-background",
            )}
          />
        </span>
        <span
          data-testid="foul-mouth-pill-label"
          className={cn(
            "whitespace-nowrap text-xs font-bold uppercase tracking-wide transition-colors",
            foulMouth ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]" : "text-foreground",
          )}
        >
          {saving ? "Saving…" : foulMouth ? "foul mouth mode" : "off"}
        </span>
      </button>
      <span id="foul-mouth-status" className="sr-only">
        {saving ? "Saving" : foulMouth ? "Foul mouth mode is on" : "Foul mouth is off"}
      </span>
      {/* Live region lives outside the switch so mobile screen readers
          announce state changes without re-reading the whole control. */}
      <span role="status" aria-live="polite" className="sr-only">
        {saving ? "Saving Foul Mouth setting" : `Foul Mouth turned ${foulMouth ? "on" : "off"}`}
      </span>
    </div>
  );
}
