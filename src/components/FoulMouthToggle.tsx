import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";

export interface FoulMouthToggleProps {
  /** Disable interaction while an upstream action is running (e.g. generation). */
  disabled?: boolean;
  /** Show the destructive "Don't leave it on clean!" reminder when off. */
  showReminder?: boolean;
  className?: string;
}

/**
 * Profile-backed OG Foul Mouth toggle.
 *
 * Single source of truth — import this component everywhere instead of
 * recreating the markup. Uses `useFoulMouth` / `useSetFoulMouth` so the
 * value is persisted on the user profile and shared across pages.
 */
export function FoulMouthToggle({
  disabled = false,
  showReminder = true,
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
    <div className={cn("space-y-4", className)}>
      {showReminder && !foulMouth && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-3 shadow-[0_0_28px_-10px_oklch(0.62_0.22_25_/_0.8)] sm:p-4">
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-destructive/25 text-lg sm:h-10 sm:w-10">
            <Flame className="h-5 w-5 text-destructive" />
          </span>
          <div className="min-w-0 text-sm leading-snug sm:text-base">
            <p className="font-black uppercase tracking-wide text-destructive">Don't leave it on clean!</p>
            <p className="mt-0.5 text-foreground/85">
              Flip <span className="font-bold">Foul Mouth</span> on for the unfiltered, no-rules OG version. The clean one is just a demo.
            </p>
          </div>
        </div>
      )}

      <button
        id="foul-mouth-toggle"
        type="button"
        role="switch"
        aria-checked={foulMouth}
        aria-pressed={foulMouth}
        aria-label={`OG Foul Mouth — explicit lyrics mode, currently turned ${foulMouth ? "on" : "off"}. Activate to turn ${foulMouth ? "off" : "on"}.`}
        aria-describedby="foul-mouth-status"
        aria-busy={locked || saving}
        onClick={toggle}
        onKeyDown={(e) => {
          if (locked) return;
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggle();
          }
        }}
        disabled={locked}
        className={cn(
          "relative group flex w-full min-h-14 items-center gap-2 rounded-2xl border-2 px-4 py-3 text-left transition-all sm:gap-3 sm:px-5 sm:py-4",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          foulMouth
            ? "border-destructive bg-destructive/15 shadow-[0_0_24px_-6px_oklch(0.62_0.22_25_/_0.6)]"
            : "border-white/15 bg-white/[0.04] hover:border-white/25",
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl transition sm:h-12 sm:w-12 sm:text-2xl",
            foulMouth ? "bg-destructive/30" : "bg-white/5",
          )}
        >
          {foulMouth ? "🤬" : "🧼"}
        </div>
        <div className="min-w-0 shrink">
          <div className="truncate font-bungee text-base leading-tight sm:text-xl">
            OG Foul Mouth ·{" "}
            <span
              id="foul-mouth-status"
              aria-live="polite"
              className={cn(
                "font-bungee",
                foulMouth ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {saving ? "Saving…" : foulMouth ? "Turned on" : "Turned off"}
            </span>
          </div>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none ml-auto relative inline-flex shrink-0 items-center h-9 w-[112px] rounded-full border-2 transition sm:h-10 sm:w-[128px]",
            foulMouth
              ? "border-destructive bg-destructive/30 shadow-[0_0_18px_-4px_oklch(0.62_0.22_25_/_0.8)]"
              : "border-white/25 bg-white/10",
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background shadow-md transition-all sm:h-8 sm:w-8",
              foulMouth ? "left-[calc(100%-2rem)] sm:left-[calc(100%-2.25rem)] bg-destructive-foreground" : "left-1",
            )}
          />
          <span
            className={cn(
              "w-full text-center font-bungee text-[10px] uppercase tracking-[0.14em] sm:text-xs",
              foulMouth ? "pr-9 text-destructive-foreground" : "pl-9 text-foreground",
            )}
          >
            {saving ? "Saving…" : foulMouth ? "Turned on" : "Turned off"}
          </span>
        </span>

      </button>
    </div>
  );
}
