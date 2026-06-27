import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Layout-token lockdown for the merged OgChat header (foul-mouth hero +
 * secondary controls). Verifies:
 *   - mobile (<sm): stacks (flex-col), hero is full width, controls wrap
 *   - sm+: side-by-side row, hero flexes (sm:flex-1 + min-w-0 to prevent
 *     overflow), controls have a fixed column width so spacing is balanced
 *     and the two pieces never overlap or clip.
 */
const SRC = readFileSync(
  resolve(__dirname, "../components/messenger/OgChat.tsx"),
  "utf8",
);

function classesFor(testId: string) {
  // grab the className string on the element carrying data-testid={testId}
  const re = new RegExp(
    String.raw`data-testid=["']${testId}["'][\s\S]{0,400}?className=(?:\{?cn\()?[\s\S]{0,400}?["\`]([^"\`]+)["\`]`,
  );
  const m = SRC.match(re);
  if (!m) throw new Error(`could not locate className for ${testId}`);
  return m[1];
}

describe("OgChat merged header layout tokens", () => {
  const header = classesFor("ogchat-header");
  const hero = classesFor("ogchat-foulmouth-hero");
  const controls = classesFor("ogchat-controls");

  it("stacks on mobile and goes side-by-side from sm:", () => {
    expect(header).toMatch(/\bflex-col\b/);
    expect(header).toMatch(/\bsm:flex-row\b/);
    expect(header).toMatch(/\bsm:items-center\b/);
  });

  it("hero fills the row and shrinks safely on sm+", () => {
    expect(hero).toMatch(/\bw-full\b/);
    expect(hero).toMatch(/\bsm:flex-1\b/);
    expect(hero).toMatch(/\bsm:min-w-0\b/);
    // overflow-hidden keeps the rounded pill from clipping at 320px
    expect(hero).toMatch(/\boverflow-hidden\b/);
  });

  it("controls take a fixed, balanced column on sm+ and never shrink", () => {
    expect(controls).toMatch(/\bsm:flex-col\b/);
    expect(controls).toMatch(/sm:w-\[180px\]/);
    expect(controls).toMatch(/\bsm:shrink-0\b/);
    // mobile: must wrap to avoid horizontal overflow at 320/360
    expect(controls).toMatch(/\bflex-wrap\b/);
  });
});
