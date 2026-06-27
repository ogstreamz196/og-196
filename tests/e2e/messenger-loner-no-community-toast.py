"""Regression: Loner Mode must never trigger a 'Posted to OG Community' toast.

Runs in two viewports (mobile + desktop). Exits non-zero if the toast appears.

Assumes the dev server is running on localhost (port discovered via env or 8080)
and that LOVABLE_BROWSER_SUPABASE_* session vars are injected for an
authenticated user. See tests/e2e/messenger-loner-no-community-toast.md.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

SHOTS = Path("/tmp/browser/loner-toast")
SHOTS.mkdir(parents=True, exist_ok=True)

PORT = os.environ.get("DEV_PORT", "8080")
BASE = f"http://localhost:{PORT}"

VIEWPORTS = [
    ("mobile", {"width": 390, "height": 780}),
    ("desktop", {"width": 1280, "height": 900}),
]


async def run_one(playwright, label: str, viewport: dict) -> bool:
    """Returns True on pass, False on regression."""
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context(viewport=viewport)
    page = await context.new_page()

    # Establish localhost origin BEFORE writing session into localStorage.
    await page.goto(BASE, wait_until="domcontentloaded")

    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)},"
            f" {json.dumps(session_json)})"
        )
    # Kill the legacy shareLive flag and any cached community-mode pref.
    await page.evaluate(
        "window.localStorage.removeItem('og-bot-share-live');"
        "window.localStorage.removeItem('og-messenger:last-mode');"
    )

    await page.goto(f"{BASE}/messenger", wait_until="domcontentloaded")

    # Wait for Loner composer; if the page is in Community mode, flip it.
    composer = page.get_by_test_id("og-loner-composer")
    try:
        await composer.wait_for(timeout=8000)
    except Exception:
        toggle = page.get_by_role("switch", name=lambda n: "Loner" in (n or "") or "Community" in (n or ""))
        if await toggle.count():
            await toggle.first.click()
            # Confirm dialog if present
            confirm = page.get_by_role("button", name="Yes, back to Loner")
            if await confirm.count():
                await confirm.first.click()
        await composer.wait_for(timeout=8000)

    await composer.fill("hello loner")
    await page.get_by_test_id("og-loner-send").click()

    # Poll for the regression toast for up to 3s.
    saw_community_toast = False
    for _ in range(15):
        await page.wait_for_timeout(200)
        toasts = await page.locator("[data-sonner-toast], li[role='status']").all_text_contents()
        if any("posted to og community" in t.lower() for t in toasts):
            saw_community_toast = True
            break

    await page.screenshot(path=str(SHOTS / f"{label}.png"))
    await browser.close()

    status = "FAIL" if saw_community_toast else "pass"
    print(f"[{label}] {status} (toast appeared: {saw_community_toast})")
    return not saw_community_toast


async def main():
    async with async_playwright() as pw:
        results = []
        for label, vp in VIEWPORTS:
            ok = await run_one(pw, label, vp)
            results.append(ok)
        if not all(results):
            print("REGRESSION: Loner Mode produced a Community toast.")
            sys.exit(1)
        print("OK: no Community toast in Loner Mode on any viewport.")


if __name__ == "__main__":
    asyncio.run(main())
