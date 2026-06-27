import type { MessengerMode } from "@/hooks/use-messenger-mode";

/**
 * Pure label/state helpers for the Loner ↔ OG Community toggle.
 * Centralised so UI copy and the underlying mode can't drift apart
 * (covered by src/lib/messenger-mode-labels.test.ts).
 */

export function isCommunityMode(mode: MessengerMode): boolean {
  return mode === "community";
}

export function modeHeading(mode: MessengerMode): string {
  return isCommunityMode(mode) ? "OG Community Mode" : "OG Bot Loner Mode";
}

export function modeBadge(mode: MessengerMode): string {
  return isCommunityMode(mode)
    ? "OG Community Mode · public room"
    : "OG Bot Loner Mode · private";
}

/** Visible pill copy — describes the action the NEXT click will perform. */
export function toggleActionLabel(mode: MessengerMode, isSaving: boolean): string {
  if (isSaving) return "Saving…";
  return isCommunityMode(mode) ? "Turn on Loner" : "Turn off Loner";
}

/** Screen-reader label — full action sentence. */
export function toggleAriaLabel(mode: MessengerMode): string {
  return isCommunityMode(mode)
    ? "Turn on OG Bot Loner Mode (leave Community)"
    : "Turn off Loner Mode (switch to OG Community Mode)";
}

/** The mode the toggle will move to when clicked. */
export function nextMode(mode: MessengerMode): MessengerMode {
  return isCommunityMode(mode) ? "loner" : "community";
}
