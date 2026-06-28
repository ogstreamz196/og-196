#!/usr/bin/env node
/**
 * Fails if any visible text node on the site renders in a blue/indigo/cyan/
 * violet/fuchsia/purple hue. Walks every text-bearing element, reads its
 * computed `color`, and classifies the hue in HSL space.
 *
 * Hue bands considered "blue family" (and therefore banned for text):
 *   - 180°–305°  (cyan → blue → indigo → violet → purple → magenta-ish)
 * White, off-white, red, orange, yellow, green pass freely.
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 node scripts/no-blue-text-check.mjs
 *
 * Optional:
 *   ROUTES="/ /messenger /library /buy-coins /referrals /settings"
 *   VIEWPORTS="mobile,tablet,desktop"
 *   SAT_MIN=0.18      // ignore near-greys
 *   LIGHT_MAX=0.92    // ignore near-whites
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const ROUTES = (
  process.env.ROUTES ??
  "/ /welcome /messenger /library /buy-coins /referrals /settings /purchase-history"
)
  .split(/\s+/)
  .filter(Boolean);

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
};
const PICKED = (process.env.VIEWPORTS ?? "mobile,desktop").split(",");

const SAT_MIN = Number(process.env.SAT_MIN ?? 0.18);
const LIGHT_MAX = Number(process.env.LIGHT_MAX ?? 0.92);
const OUT = "/mnt/documents/no-blue-text";

const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const violations = [];

try {
  for (const vpName of PICKED) {
    const vp = VIEWPORTS[vpName.trim()];
    if (!vp) continue;
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();

    // restore signed-in session if available so authenticated routes render
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    if (storageKey && sessionJson) {
      await page.evaluate(
        ([k, v]) => window.localStorage.setItem(k, v),
        [storageKey, sessionJson],
      );
    }

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);

      const offenders = await page.evaluate(
        ({ satMin, lightMax }) => {
          // rgb(r,g,b) → hsl
          const toHsl = (r, g, b) => {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const l = (max + min) / 2;
            let h = 0, s = 0;
            if (max !== min) {
              const d = max - min;
              s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
              switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
              }
              h *= 60;
            }
            return { h, s, l };
          };
          const parseColor = (str) => {
            const m = str.match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
            const [r, g, b, a = 1] = parts;
            if (a < 0.2) return null;
            return { r, g, b };
          };
          const sel = (el) => {
            const id = el.id ? `#${el.id}` : "";
            const cls = el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/\s+/).slice(0, 4).join(".")
              : "";
            return `${el.tagName.toLowerCase()}${id}${cls}`;
          };
          const hits = [];
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            null,
          );
          let node = walker.currentNode;
          while ((node = walker.nextNode())) {
            const el = node;
            const tag = el.tagName;
            if (tag === "SVG" || tag === "PATH" || tag === "SCRIPT" || tag === "STYLE") continue;
            // must contain direct visible text
            const hasText = Array.from(el.childNodes).some(
              (c) => c.nodeType === 3 && c.nodeValue && c.nodeValue.trim().length > 0,
            );
            if (!hasText) continue;
            const cs = getComputedStyle(el);
            const rgb = parseColor(cs.color);
            if (!rgb) continue;
            const { h, s, l } = toHsl(rgb.r, rgb.g, rgb.b);
            if (s < satMin) continue;
            if (l > lightMax) continue;
            // blue family: cyan(180) → purple/magenta(305)
            if (h >= 180 && h <= 305) {
              hits.push({
                selector: sel(el),
                color: cs.color,
                hsl: `h=${h.toFixed(0)} s=${s.toFixed(2)} l=${l.toFixed(2)}`,
                text: (el.textContent || "").trim().slice(0, 60),
              });
              if (hits.length >= 25) break;
            }
          }
          return hits;
        },
        { satMin: SAT_MIN, lightMax: LIGHT_MAX },
      );

      if (offenders.length) {
        const shot = `${OUT}/${vpName}__${route.replace(/\W+/g, "_") || "home"}.png`;
        await page.screenshot({ path: shot });
        for (const o of offenders) {
          violations.push({ viewport: vpName, route, screenshot: shot, ...o });
        }
        console.error(
          `✗ [${vpName}] ${route} — ${offenders.length} blue text node(s)`,
        );
      } else {
        console.log(`✓ [${vpName}] ${route}`);
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  `${OUT}/report.json`,
  JSON.stringify({ base: BASE, violations }, null, 2),
);

if (violations.length) {
  console.error(`\nFAIL — ${violations.length} blue text node(s). Report: ${OUT}/report.json`);
  for (const v of violations.slice(0, 20)) {
    console.error(`  [${v.viewport}] ${v.route}  ${v.selector}  color=${v.color}  "${v.text}"`);
  }
  process.exit(1);
}
console.log("\nOK — no blue text detected.");
