import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Lock the Library page's structural spacing tokens.
 * A companion runtime check lives in scripts/library-layout-check.mjs,
 * which boots Playwright at mobile/tablet/desktop and reads the
 * computed `gap`, `padding-bottom` and `margin-bottom` for these
 * data-testid nodes. Both must stay in sync — if you change a token
 * below you must update the runtime check too.
 */
const SRC = readFileSync(
  join(__dirname, "..", "routes", "_authenticated", "library.index.tsx"),
  "utf8",
);

const REQUIRED: Array<{ name: string; pattern: RegExp }> = [
  {
    name: "library-root uses gap-4 + pb-20",
    pattern: /data-testid="library-root"[^>]*className="[^"]*\bgap-4\b[^"]*\bpb-20\b/,
  },
  {
    name: "library-hero uses gap-4 + pb-4 + grid",
    pattern:
      /data-testid="library-hero"[^>]*className="[^"]*\bgrid\b[^"]*\bgap-4\b[^"]*\bpb-4\b/,
  },
  {
    name: "Your Library header uses mb-3 + gap-3",
    pattern:
      /data-testid="library-your-header"[^>]*className="[^"]*\bmb-3\b[^"]*\bgap-3\b/,
  },
  {
    name: "library cards grid uses gap-3",
    pattern: /data-testid="library-cards"[^>]*className="[^"]*\bgrid\b[^"]*\bgap-3\b/,
  },
];

describe("library layout tokens", () => {
  for (const { name, pattern } of REQUIRED) {
    it(name, () => {
      expect(pattern.test(SRC), `Missing token rule: ${name}`).toBe(true);
    });
  }
});
