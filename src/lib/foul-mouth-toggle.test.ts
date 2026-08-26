import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the reusable FoulMouthToggle component and its single use in Library:
 *   1. Toggle markup lives in one place (the shared component).
 *   2. Library imports the component and renders it exactly once.
 *   3. The component is wired to the profile-backed hooks (not local state).
 *   4. Exposes correct ARIA state to screen readers.
 */

const COMPONENT = join(process.cwd(), "src/components/FoulMouthToggle.tsx");
const LIBRARY = join(process.cwd(), "src/routes/_authenticated/library.index.lazy.tsx");

const componentSrc = readFileSync(COMPONENT, "utf8");
const librarySrc = readFileSync(LIBRARY, "utf8");

describe("FoulMouthToggle component", () => {
  it("owns the single foul-mouth-toggle id", () => {
    const matches = componentSrc.match(/id=["']foul-mouth-toggle["']/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("is wired to the profile-backed hooks", () => {
    expect(componentSrc).toMatch(/from\s+["']@\/hooks\/use-foul-mouth["']/);
    expect(componentSrc).toMatch(/useFoulMouth\s*\(/);
    expect(componentSrc).toMatch(/useSetFoulMouth\s*\(/);
  });

  it("persists via the mutation, not local useState", () => {
    expect(componentSrc).toMatch(/mutation\.mutate\(/);
    expect(componentSrc).not.toMatch(/useState<\s*boolean\s*>/);
  });

  it("exposes accessible on/off state", () => {
    expect(componentSrc).toMatch(/aria-pressed=\{foulMouth\}/);
    expect(componentSrc).toMatch(/aria-checked=\{foulMouth\}/);
    expect(componentSrc).toMatch(/aria-live=["']polite["']/);
  });

  it("swaps the label between active and inactive states", () => {
    // The pill label reads "foul mouth mode" when on and "off" when off.
    const labelExpr = /foulMouth\s*\?\s*"foul mouth mode"\s*:\s*"off"/g;
    const matches = componentSrc.match(labelExpr) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps the pill label readable in both states", () => {
    expect(componentSrc).toMatch(/data-testid=["']foul-mouth-pill-label["']/);
    // whitespace-nowrap prevents the label from clipping inside the pill.
    expect(componentSrc).toMatch(/whitespace-nowrap/);
    // High-contrast colours: white-on-red when on, foreground when off.
    expect(componentSrc).toMatch(/text-white/);
    expect(componentSrc).toMatch(/text-foreground/);
  });
});

describe("Library page uses the shared component", () => {
  it("imports FoulMouthToggle", () => {
    expect(librarySrc).toMatch(/from\s+["']@\/components\/FoulMouthToggle["']/);
  });

  it("renders FoulMouthToggle exactly once", () => {
    const matches = librarySrc.match(/<FoulMouthToggle\b/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("does not inline a second foul-mouth-toggle button", () => {
    const matches = librarySrc.match(/id=["']foul-mouth-toggle["']/g) ?? [];
    expect(matches.length).toBe(0);
  });

  it("does not re-import the removed FoulMouthReminder duplicate", () => {
    expect(librarySrc).not.toMatch(/FoulMouthReminder/);
  });
});
