import type { MessengerMode } from "@/hooks/use-messenger-mode";

/**
 * Pure label/state helpers for the Loner ↔ OG Battle Zone toggle.
 * Centralised so UI copy and the underlying mode can't drift apart
 * (covered by src/lib/messenger-mode-labels.test.ts).
 */

export function isCommunityMode(mode: MessengerMode): boolean {
  return mode === "community";
}

export function modeHeading(mode: MessengerMode): string {
  return isCommunityMode(mode) ? "OG Battle Zone" : "OG Bot Loner Mode";
}

export function modeBadge(mode: MessengerMode): string {
  return isCommunityMode(mode)
    ? "OG Battle Zone · everyone vs OG Bot"
    : "OG Bot Loner Mode · private";
}

/** One-line pitch shown under the heading / on the chooser. */
export function modeTagline(mode: MessengerMode): string {
  return isCommunityMode(mode)
    ? "Everyone vs OG Bot — see if you can survive a roast battle"
    : "Just you & OG Bot · nobody else sees this";
}

/** Visible pill copy — describes the action the NEXT click will perform. */
export function toggleActionLabel(mode: MessengerMode, isSaving: boolean): string {
  if (isSaving) return "Saving…";
  return isCommunityMode(mode) ? "Go Private" : "Enter Battle Zone";
}

/** Screen-reader label — full action sentence. */
export function toggleAriaLabel(mode: MessengerMode): string {
  return isCommunityMode(mode)
    ? "Go Private (leave the OG Battle Zone)"
    : "Enter Battle Zone (leave private chat with OG Bot)";
}

/** The mode the toggle will move to when clicked. */
export function nextMode(mode: MessengerMode): MessengerMode {
  return isCommunityMode(mode) ? "loner" : "community";
}
