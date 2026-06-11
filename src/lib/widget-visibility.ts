// Pure helper: decides whether the OG Bot widget should render given the
// developer's token set. Mirrors the contract enforced by validate_bot_token:
// the widget is visible only when at least one token is active.
//
// Internal portal users (no tokens at all) always see the widget — they are
// not gated by the developer-token marketplace.

export type TokenLike = { status: string };

export function computeWidgetVisible(tokens: TokenLike[] | null | undefined): boolean {
  if (!tokens || tokens.length === 0) return true; // internal / no-token users
  return tokens.some((t) => t.status === "active");
}
