/**
 * Pure detection helper for the DodgyLogo cursor-dodge behaviour.
 *
 * Returns `true` when the device should run the desktop cursor-dodge
 * animation, `false` when it should fall back to the cheap CSS bob.
 *
 * Kept in its own file so we can unit-test the matrix of pointer/hover/
 * viewport/reduced-motion combinations without rendering React.
 */
export type MatchMediaFn = (query: string) => { matches: boolean };

export const DODGE_QUERIES = [
  "(pointer: fine)",
  "(hover: hover)",
  "(min-width: 1024px)",
  "(prefers-reduced-motion: no-preference)",
] as const;

export function shouldDodgeCursor(
  matchMedia: MatchMediaFn,
  opts: { touched?: boolean } = {},
): boolean {
  if (opts.touched) return false;
  return DODGE_QUERIES.every((q) => matchMedia(q).matches);
}
