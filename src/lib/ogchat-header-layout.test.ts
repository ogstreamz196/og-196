import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Layout-token lockdown for the merged OgChat header (foul-mouth hero +
 * secondary controls). Verifies:
 *   - mobile (<sm): compact two-column grid keeps controls visible without
 *     consuming the message viewport
 *   - sm+: side-by-side row, hero flexes and controls keep a balanced fixed
 *     width so the two pieces never overlap or clip.
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

  it("uses a compact mobile grid and goes side-by-side from sm:", () => {
    expect(header).toMatch(/\bgrid\b/);
    expect(header).toMatch(/grid-cols-\[minmax\(0,1fr\)_auto\]/);
    expect(header).toMatch(/\bsm:flex\b/);
  });

  it("hero fills the row and shrinks safely on sm+", () => {
    expect(hero).toMatch(/\bw-full\b/);
    expect(hero).toMatch(/\bsm:flex-1\b/);
    expect(hero).toMatch(/\bmin-w-0\b/);
    // overflow-hidden keeps the rounded pill from clipping at 320px
    expect(hero).toMatch(/\boverflow-hidden\b/);
  });

  it("controls take a fixed, balanced column on sm+ and never shrink", () => {
    expect(controls).toMatch(/\bsm:flex-col\b/);
    expect(controls).toMatch(/sm:w-\[180px\]/);
    expect(controls).toMatch(/\bsm:shrink-0\b/);
    // Mobile controls remain a single compact row to preserve chat height.
    expect(controls).toMatch(/\bitems-center\b/);
  });
});
