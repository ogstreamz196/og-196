#!/usr/bin/env python3
"""Mobile scrollability + scroll-affordance a11y check (see repo docs)."""
import re



At 390x844 (mobile), verifies:
  1. /library main list is vertically scrollable and applies the shared
     touch tokens (touch-action: pan-y, overscroll-behavior-y: contain).
  2. A Radix Dialog (home "Ask OG Bot" trigger) opens, its [role="dialog"]
     content applies the same touch tokens, and has an accessible name.
  3. A Radix Sheet (mobile sidebar via the sidebar trigger) opens, its
     content applies the same touch tokens, and exposes role="dialog".
  4. Scroll-fade mask-image is gated by `prefers-contrast: no-preference`
     AND `prefers-reduced-transparency: no-preference`, so faded edge text
     is disabled for users who opted into higher contrast.

Exit 0 clean, 1 on any failure.

Run:
  python3 tests/e2e/mobile-scroll-affordance.py
"""
import asyncio
import json
import os
import sys
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:8080")
VIEWPORT = {"width": 390, "height": 844}

storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

failures = []
def ok(msg):   print(f"  ✓ {msg}")
def bad(msg):  failures.append(msg); print(f"  ✗ {msg}")

async def restore_auth(context, page):
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE
        await context.add_cookies(cookies)
    await page.goto(BASE, wait_until="domcontentloaded")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )

def assert_touch(info, label):
    ta = info.get("touchAction") or ""
    ob = info.get("overscrollBehaviorY") or ""
    (ok if "pan-y" in ta else bad)(f"{label}: touch-action includes pan-y (got '{ta}')")
    (ok if "contain" in ob else bad)(f"{label}: overscroll-behavior-y contain (got '{ob}')")

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # -------- 1) /library main list --------
        print("\n/library — main list scrollability")
        ctx = await browser.new_context(viewport=VIEWPORT)
        page = await ctx.new_page()
        await restore_auth(ctx, page)
        await page.goto(f"{BASE}/library", wait_until="domcontentloaded")
        try:
            await page.wait_for_selector('[data-testid="library-root"]', timeout=15000)
        except Exception as e:
            bad(f"library-root did not render: {e}")
        else:
            info = await page.evaluate("""() => {
                const el = document.querySelector('[data-testid=\"library-root\"]');
                const s = getComputedStyle(el);
                return {
                    touchAction: s.touchAction,
                    overscrollBehaviorY: s.overscrollBehaviorY,
                    dsh: document.documentElement.scrollHeight,
                    dch: document.documentElement.clientHeight,
                };
            }""")
            assert_touch(info, "library-root")
            if info["dsh"] <= info["dch"] + 4:
                ok("library fits without scroll (nothing to scroll)")
            else:
                scrolled = await page.evaluate("""() => {
                    const targets = [...document.querySelectorAll('main,[data-scroll-container],.overflow-y-auto,.overflow-auto')];
                    for (const t of targets) {
                        const before = t.scrollTop; t.scrollTop = 400;
                        if (t.scrollTop > before) return { via: 'container', delta: t.scrollTop - before };
                    }
                    const before = window.scrollY; window.scrollTo(0, 400);
                    return { via: 'window', delta: window.scrollY - before };
                }""")
                if scrolled["delta"] > 10:
                    ok(f"library scrolled via {scrolled['via']} (+{scrolled['delta']}px)")
                else:
                    bad(f"library did not scroll (via={scrolled['via']} delta={scrolled['delta']})")
        await ctx.close()

        # -------- 2) Radix Dialog on / --------
        print("\n/ — Radix Dialog (Ask OG Bot)")
        ctx = await browser.new_context(viewport=VIEWPORT)
        page = await ctx.new_page()
        await restore_auth(ctx, page)
        await page.goto(f"{BASE}/", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        try:
            trigger = page.get_by_role("button", name=lambda n: n and ("Start any task" in n or "Ask OG Bot" in n)).first
            await trigger.wait_for(timeout=10000)
            await trigger.click()
            dialog = page.locator('[role="dialog"]').first
            await dialog.wait_for(timeout=5000)
            info = await dialog.evaluate("""el => {
                const s = getComputedStyle(el);
                return {
                    touchAction: s.touchAction,
                    overscrollBehaviorY: s.overscrollBehaviorY,
                    role: el.getAttribute('role'),
                    hasLabel: !!(el.getAttribute('aria-labelledby') || el.getAttribute('aria-label')),
                };
            }""")
            assert_touch(info, "dialog")
            (ok if info["role"] == "dialog" else bad)(f"dialog role=dialog (got '{info['role']}')")
            (ok if info["hasLabel"] else bad)("dialog has accessible name")
        except Exception as e:
            bad(f"dialog check failed: {e}")
        await ctx.close()

        # -------- 3) Radix Sheet (mobile sidebar) --------
        print("\n/ — Radix Sheet (mobile sidebar)")
        ctx = await browser.new_context(viewport=VIEWPORT)
        page = await ctx.new_page()
        await restore_auth(ctx, page)
        await page.goto(f"{BASE}/", wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)
        try:
            trigger = page.locator('[data-sidebar="trigger"]').first
            await trigger.wait_for(timeout=10000)
            await trigger.click()
            sheet = page.locator('[data-sidebar="sidebar"][data-mobile="true"], [role="dialog"]').first
            await sheet.wait_for(timeout=5000)
            info = await sheet.evaluate("""el => {
                const s = getComputedStyle(el);
                return {
                    touchAction: s.touchAction,
                    overscrollBehaviorY: s.overscrollBehaviorY,
                    role: el.getAttribute('role'),
                    hasLabel: !!(el.getAttribute('aria-labelledby') || el.getAttribute('aria-label') || el.querySelector('h1,h2,h3')),
                };
            }""")
            assert_touch(info, "sheet")
            (ok if info["role"] == "dialog" else bad)(f"sheet role=dialog (got '{info['role']}')")
            (ok if info["hasLabel"] else bad)("sheet has accessible name")
        except Exception as e:
            bad(f"sheet check failed: {e}")
        await ctx.close()

        # -------- 4) Scroll-fade a11y gating --------
        print("\nscroll-fade mask gated by prefers-contrast / prefers-reduced-transparency")
        ctx = await browser.new_context(viewport=VIEWPORT)
        page = await ctx.new_page()
        await restore_auth(ctx, page)
        await page.goto(f"{BASE}/library", wait_until="domcontentloaded")
        await page.wait_for_timeout(500)
        guarded = await page.evaluate("""() => {
            const wanted = ['prefers-contrast', 'prefers-reduced-transparency'];
            for (const sheet of Array.from(document.styleSheets)) {
                try {
                    for (const rule of Array.from(sheet.cssRules || [])) {
                        const t = rule.cssText || '';
                        if (t.includes('mask-image') && wanted.every(w => t.includes(w))) return true;
                    }
                } catch (e) {}
            }
            return false;
        }""")
        (ok if guarded else bad)("mask-image is gated behind both a11y prefs media queries")
        await ctx.close()

        await browser.close()

    if failures:
        print(f"\n{len(failures)} failure(s):", file=sys.stderr)
        for f in failures: print("  - " + f, file=sys.stderr)
        sys.exit(1)
    print("\nAll mobile scroll + a11y checks passed.")

asyncio.run(run())
