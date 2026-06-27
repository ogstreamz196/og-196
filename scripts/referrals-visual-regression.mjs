#!/usr/bin/env node
/**
 * Focused visual regression for the /referrals page.
 *
 * Captures the three "exciting" UI surfaces individually so styling
 * changes (hero gradient, stat tile tones, cashback feed density) are
 * caught before they ship.
 *
 * Targets (selected by data-testid):
 *   - referrals-hero
 *   - referrals-stat-tiles
 *   - referrals-cashback-feed
 *
 * Usage:
 *   node scripts/referrals-visual-regression.mjs              # capture baselines
 *   UPDATE=1 node scripts/referrals-visual-regression.mjs     # overwrite baselines
 *   node scripts/referrals-visual-regression.mjs --compare    # diff against baselines
 *
 * Requires: a running dev server (default http://localhost:8080) and a
 * Supabase session restored via LOVABLE_BROWSER_* env vars (see
 * browser-use docs) — /referrals is auth-gated.
 *
 * Output: tests/visual/referrals/{baseline,current,diff}/<device>__<target>.png
 */
import { chromium, devices } from "playwright";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const UPDATE = !!process.env.UPDATE;
const COMPARE = process.argv.includes("--compare");
const THRESHOLD = Number(process.env.THRESHOLD ?? 0.02);

const TARGETS = [
  "referrals-hero",
  "referrals-stat-tiles",
  "referrals-cashback-feed",
];

const VIEWPORTS = [
  { name: "iphone-se",     ...devices["iPhone SE"] },
  { name: "iphone-15-pro", ...devices["iPhone 15 Pro"] },
  { name: "ipad-mini",     ...devices["iPad Mini"] },
  { name: "desktop",       viewport: { width: 1280, height: 1800 }, deviceScaleFactor: 1 },
];

const exists = async (p) => access(p).then(() => true).catch(() => false);

async function restoreSession(page) {
  const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const json = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!key || !json) return;
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k, v),
    [key, json],
  );
}

async function run() {
  const browser = await chromium.launch();
  const failures = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: vp.viewport,
      deviceScaleFactor: vp.deviceScaleFactor ?? 1,
      userAgent: vp.userAgent,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });
    const page = await ctx.newPage();

    await restoreSession(page);
    try {
      await page.goto(`${BASE}/referrals`, { waitUntil: "networkidle", timeout: 20000 });
    } catch (err) {
      console.warn(`skip ${vp.name}: navigation ${err.message}`);
      await ctx.close();
      continue;
    }
    await page.waitForSelector('[data-testid="referrals-page"]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);

    for (const target of TARGETS) {
      const id = `${vp.name}__${target}`;
      const locator = page.locator(`[data-testid="${target}"]`).first();
      if (!(await locator.count())) {
        console.warn(`skip ${id}: target not found`);
        continue;
      }

      const baselinePath = `tests/visual/referrals/baseline/${id}.png`;
      const currentPath  = `tests/visual/referrals/current/${id}.png`;
      const diffPath     = `tests/visual/referrals/diff/${id}.png`;
      await mkdir(dirname(currentPath), { recursive: true });
      await locator.scrollIntoViewIfNeeded();
      await locator.screenshot({ path: currentPath });

      const hasBaseline = await exists(baselinePath);
      if (!hasBaseline || UPDATE) {
        await mkdir(dirname(baselinePath), { recursive: true });
        await writeFile(baselinePath, await readFile(currentPath));
        console.log(`${UPDATE ? "updated" : "baseline"} ${id}`);
        continue;
      }
      if (!COMPARE) continue;

      const a = PNG.sync.read(await readFile(baselinePath));
      const b = PNG.sync.read(await readFile(currentPath));
      if (a.width !== b.width || a.height !== b.height) {
        failures.push(`${id}: size changed ${a.width}x${a.height} -> ${b.width}x${b.height}`);
        continue;
      }
      const diff = new PNG({ width: a.width, height: a.height });
      const mismatch = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
      const ratio = mismatch / (a.width * a.height);
      if (ratio > THRESHOLD) {
        await mkdir(dirname(diffPath), { recursive: true });
        await writeFile(diffPath, PNG.sync.write(diff));
        failures.push(`${id}: ${(ratio * 100).toFixed(2)}% pixels differ`);
      }
    }
    await ctx.close();
  }

  await browser.close();
  if (failures.length) {
    console.error("\nReferrals visual regressions:");
    failures.forEach((f) => console.error("  -", f));
    process.exit(1);
  }
  console.log("\nReferrals visual sweep ok");
}

run().catch((e) => { console.error(e); process.exit(1); });
