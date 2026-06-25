/**
 * Pure routing helper for OG chat messages.
 *
 * Decides whether a message should go to the private OG-GPT pipeline or to
 * the shared Live Chat community feed. Centralised so the UI and tests share
 * the exact same logic — fixes the regression where Live Chat Mode hijacked
 * quick-start chips.
 */
export type OgChatTarget = "private" | "community" | "noop";

export interface RouteOpts {
  /** Force the private pipeline (quick-start chips always pass true). */
  forcePrivate?: boolean;
  /** Live Chat Mode toggle (a.k.a. shareLive). */
  shareLive: boolean;
  /** Trimmed text content (empty string for attachment-only). */
  text: string;
  /** True when an attachment is present. */
  hasAttachment?: boolean;
}

export function routeOgMessage(opts: RouteOpts): OgChatTarget {
  const { forcePrivate, shareLive, text, hasAttachment } = opts;
  if (!text && !hasAttachment) return "noop";
  if (shareLive && !forcePrivate) {
    // Community feed is text-only — attachment-only sends fall back to noop.
    return text ? "community" : "noop";
  }
  return "private";
}
