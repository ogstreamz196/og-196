import { Skull } from "lucide-react";
import { cn } from "@/lib/utils";

interface FoulMouthReminderProps {
  /** Whether Foul Mouth is currently enabled. */
  enabled: boolean;
  /** Called when the user taps the reminder. Should toggle or scroll to the toggle. */
  onAction: () => void;
  className?: string;
}

/**
 * Persistent on/off reminder for the Foul Mouth toggle. Single tap takes the
 * user straight to (or directly flips) the toggle. Shown on MusicHUB and the
 * Messenger so the unfiltered OG vibe is always one tap away.
 */
export function FoulMouthReminder({ enabled, onAction, className }: FoulMouthReminderProps) {
  return (
    <button
      type="button"
      onClick={onAction}
      aria-pressed={enabled}
      aria-label={
        enabled
          ? "Foul Mouth is ON. Tap to turn off."
          : "Foul Mouth is OFF. Tap to turn on."
      }
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left shadow-sm transition-all active:scale-[0.99] sm:px-4 sm:py-3",
        enabled
          ? "border-destructive/60 bg-gradient-to-r from-destructive/20 via-destructive/10 to-transparent hover:border-destructive"
          : "border-amber-400/50 bg-gradient-to-r from-amber-400/15 via-amber-400/10 to-transparent hover:border-amber-300",
        className,
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg transition-transform group-hover:scale-110",
          enabled
            ? "bg-destructive text-destructive-foreground shadow-[0_0_14px_-2px_hsl(var(--destructive)/0.7)]"
            : "bg-amber-400/20 text-amber-300",
        )}
        aria-hidden="true"
      >
        {enabled ? "🤬" : <Skull className="h-5 w-5" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Foul Mouth · {enabled ? "ON" : "OFF"}
        </span>
        <span className="truncate text-sm font-bold text-foreground sm:text-base">
          {enabled
            ? "Full savage mode. Tap to switch to clean."
            : "Don't walk away clean — tap to unleash OG."}
        </span>
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border-2 transition-colors",
          enabled ? "border-destructive bg-destructive" : "border-amber-400/60 bg-muted",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-background shadow-md transition-all",
            enabled ? "left-[calc(100%-1.15rem)]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
