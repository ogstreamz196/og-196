import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Canonical typography + card rules applied to the home page
// (src/routes/_authenticated/index.tsx). These same rules must appear on every
// other landing page so the design stays in sync across mobile / tablet /
// desktop. We assert by source-scan to keep the test fast and visual-render-free
// — the matching screenshots/computed-style audit lives in
// /mnt/documents/typography-audit/.
const RULES = {
  cardShell: 'rounded-[2rem] border-2 border-white/15',
  cardShadow: 'shadow-[0_18px_50px_-20px_rgba(80,60,255,0.35)]',
  cardTitle: /text-(?:3xl|4xl|5xl)\s+font-(?:black|semibold)/,
  cardBody: /text-lg/,
  container: 'max-w-7xl',
  sectionGap: 'gap-14',
};

const LANDING_PAGES = [
  "src/routes/welcome.tsx",
  "src/routes/trust.tsx",
  "src/routes/portal.$slug.tsx",
];

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("landing page typography parity", () => {
  for (const page of LANDING_PAGES) {
    describe(page, () => {
      const src = read(page);

      it("uses the home page card shell (rounded-[2rem] + border-2 border-white/15)", () => {
        expect(src).toContain(RULES.cardShell);
      });

      it("uses the home page card shadow token", () => {
        expect(src).toContain(RULES.cardShadow);
      });

      it("uses the home page max-w-7xl container", () => {
        expect(src).toContain(RULES.container);
      });

      it("uses the home page gap-14 section rhythm", () => {
        expect(src).toContain(RULES.sectionGap);
      });

      it("has at least one large card title (text-3xl/4xl/5xl + font-black/semibold)", () => {
        expect(src).toMatch(RULES.cardTitle);
      });

      it("has at least one text-lg body copy class", () => {
        expect(src).toMatch(RULES.cardBody);
      });
    });
  }
});
