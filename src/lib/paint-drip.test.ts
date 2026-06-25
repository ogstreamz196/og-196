import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Automated regression guard for the dark-mode "paint-drip" name styling
// on the dashboard hero. Pairs with the visual screenshot script at
// scripts/ui-check-paint-drip.mjs (run via Playwright in CI / locally) —
// this source-scan test catches the common regression modes without a
// browser: the className being dropped, the CSS utility being removed,
// or the red drips losing their color/animation.

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("dashboard name paint-drip (dark mode)", () => {
  const home = read("src/routes/_authenticated/index.tsx");
  const css = read("src/styles.css");
  const root = read("src/routes/__root.tsx");

  it("keeps the site locked to dark mode on <html>", () => {
    expect(root).toMatch(/<html[^>]*className=("|')[^"']*\bdark\b/);
  });

  it("applies paint-drip + text-gradient-red to the name span", () => {
    expect(home).toMatch(/className="[^"]*\bpaint-drip\b[^"]*\btext-gradient-red\b/);
  });

  it("defines the paint-drip utility in styles.css", () => {
    expect(css).toMatch(/@utility\s+paint-drip\b/);
    expect(css).toMatch(/\.paint-drip::after\s*\{/);
  });

  it("renders red drips with a falling animation", () => {
    const block = css.match(/\.paint-drip::after\s*\{[\s\S]*?\}/)?.[0] ?? "";
    // red hue (oklch ~25deg) + red drop-shadow + the keyframe animation
    expect(block).toMatch(/oklch\([^)]*\b25\)/);
    expect(block).toMatch(/drop-shadow\([^)]*rgba\(220,\s*38,\s*38/);
    expect(block).toMatch(/animation:\s*paint-drip-fall/);
    expect(css).toMatch(/@keyframes\s+paint-drip-fall\b/);
  });
});
