import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the Library page foul-mouth toggle:
 *   1. Rendered exactly once (no duplicate reminders/pills).
 *   2. Wired to the profile-backed `useFoulMouth` / `useSetFoulMouth` hooks
 *      (NOT local component state or any ad-hoc setting).
 */

const LIBRARY = join(process.cwd(), "src/routes/_authenticated/library.index.tsx");

describe("Library foul-mouth toggle", () => {
  const src = readFileSync(LIBRARY, "utf8");

  it("renders the toggle exactly once", () => {
    const matches = src.match(/id=["']foul-mouth-toggle["']/g) ?? [];
    expect(matches.length, "exactly one foul-mouth-toggle should exist").toBe(1);
  });

  it("does not re-import the removed FoulMouthReminder duplicate", () => {
    expect(src).not.toMatch(/FoulMouthReminder/);
  });

  it("is wired to the profile-backed useFoulMouth hook", () => {
    expect(src).toMatch(/from\s+["']@\/hooks\/use-foul-mouth["']/);
    expect(src).toMatch(/useFoulMouth\s*\(/);
    expect(src).toMatch(/useSetFoulMouth\s*\(/);
  });

  it("uses the mutation (not local useState) to persist the toggle", () => {
    // The handler must call the mutation, not a local setState boolean.
    expect(src).toMatch(/setFoulMouthMutation\.mutate\(/);
  });

  it("exposes accessible on/off state to screen readers", () => {
    expect(src).toMatch(/aria-pressed=\{foulMouth\}/);
    expect(src).toMatch(/aria-checked=\{foulMouth\}/);
    expect(src).toMatch(/aria-live=["']polite["']/);
  });
});
