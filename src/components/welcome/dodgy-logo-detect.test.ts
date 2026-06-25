import { describe, it, expect } from "vitest";
import { shouldDodgeCursor, type MatchMediaFn } from "./dodgy-logo-detect";

// Builds a matchMedia stub from a profile of query → matches booleans.
function mm(profile: Record<string, boolean>): MatchMediaFn {
  return (q) => ({ matches: profile[q] ?? false });
}

// Canonical device profiles for the queries DodgyLogo evaluates.
const desktop = {
  "(pointer: fine)": true,
  "(hover: hover)": true,
  "(min-width: 1024px)": true,
  "(prefers-reduced-motion: no-preference)": true,
};
const phone = {
  "(pointer: fine)": false,
  "(hover: hover)": false,
  "(min-width: 1024px)": false,
  "(prefers-reduced-motion: no-preference)": true,
};
const tabletTouch = {
  "(pointer: fine)": false,
  "(hover: hover)": false,
  "(min-width: 1024px)": true, // iPad landscape is ≥1024
  "(prefers-reduced-motion: no-preference)": true,
};
// Hybrid 2-in-1 reporting fine pointer + hover (Surface w/ trackpad attached)
const hybridLaptop = { ...desktop };
const hybridSmall = { ...desktop, "(min-width: 1024px)": false }; // 2-in-1 in portrait
const reducedMotion = { ...desktop, "(prefers-reduced-motion: no-preference)": false };

describe("shouldDodgeCursor", () => {
  it("enables dodge on a real desktop (mouse + hover + ≥1024 + motion ok)", () => {
    expect(shouldDodgeCursor(mm(desktop))).toBe(true);
  });

  it("falls back on a touch-only phone", () => {
    expect(shouldDodgeCursor(mm(phone))).toBe(false);
  });

  it("falls back on a touch tablet even when viewport is wide", () => {
    expect(shouldDodgeCursor(mm(tabletTouch))).toBe(false);
  });

  it("enables dodge on a hybrid 2-in-1 acting as a laptop", () => {
    expect(shouldDodgeCursor(mm(hybridLaptop))).toBe(true);
  });

  it("falls back on a small hybrid (<1024px) even with trackpad attached", () => {
    expect(shouldDodgeCursor(mm(hybridSmall))).toBe(false);
  });

  it("respects prefers-reduced-motion and falls back", () => {
    expect(shouldDodgeCursor(mm(reducedMotion))).toBe(false);
  });

  it("downgrades to the fallback after a real touch is observed", () => {
    // Hybrid device starts in laptop mode, then user taps the screen.
    expect(shouldDodgeCursor(mm(hybridLaptop), { touched: false })).toBe(true);
    expect(shouldDodgeCursor(mm(hybridLaptop), { touched: true })).toBe(false);
  });

  it("treats a missing/unknown media query as non-matching (safe default)", () => {
    // Empty profile — every query returns matches:false → fallback.
    expect(shouldDodgeCursor(mm({}))).toBe(false);
  });
});
