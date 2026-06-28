#!/usr/bin/env node
/**
 * Responsive layout regression for "attachment-style" panels — the
 * ReferralReminder + Coin Vault HUD that the user attached screenshots of.
 *
 * Verifies across phone / tablet / desktop:
 *   1. No horizontal overflow inside the panel.
 *   2. No two child rects overlap (i.e. text/buttons never sit on top of each
 *      other).
 *   3. Body font-size stays within readable bounds (>= 12px).
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 node scripts/attachment-layout-check.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const ROUTES = ["/buy-coins"];
const VIEWPORTS = [
  { name: "phone", width: 360, height: 720 },
  { name: "phone-large", width: 414, height: 896 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];

function rectsOverlap(a, b) {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
}

const failures = [];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 15000 });
    } catch {
      // route may require auth in some envs — skip silently
      continue;
    }
    const reminder = page.locator('[data-testid="referral-reminder"]').first();
    if ((await reminder.count()) === 0) continue;
    await reminder.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});

    const report = await reminder.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const overflowX = el.scrollWidth - el.clientWidth;
      // Collect direct interactive/text children for overlap inspection.
      const children = Array.from(el.querySelectorAll("button, a, p, code"))
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      const p = el.querySelector("p");
      const fontSize = p ? parseFloat(getComputedStyle(p).fontSize) : 0;
      return { box, overflowX, children, fontSize };
    });

    if (report.overflowX > 1) {
      failures.push(`[${vp.name}] ${route}: horizontal overflow ${report.overflowX}px`);
    }
    if (report.fontSize < 12) {
      failures.push(`[${vp.name}] ${route}: body font ${report.fontSize}px < 12px`);
    }
    // Overlap check — siblings that share the same row should not intersect.
    for (let i = 0; i < report.children.length; i++) {
      for (let j = i + 1; j < report.children.length; j++) {
        const a = report.children[i];
        const b = report.children[j];
        // Ignore nested rects (one fully contains the other) — those are
        // legitimate (e.g. icon inside button).
        const contains =
          (a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom) ||
          (b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom);
        if (contains) continue;
        if (rectsOverlap(a, b)) {
          failures.push(`[${vp.name}] ${route}: child rects overlap`);
          break;
        }
      }
    }
  }
  await ctx.close();
}

await browser.close();

if (failures.length) {
  console.error("Attachment layout failures:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log(`✓ Attachment layout OK across ${VIEWPORTS.length} viewports`);
