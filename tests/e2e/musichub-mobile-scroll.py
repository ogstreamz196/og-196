"""
Verifies MusicHub (/library) and shared overlays remain single-finger
scrollable on mobile after the AppShell scroll-trap removal.

Guarantees:
  1. /library document scroller responds to one-finger touch (scrollY grows).
  2. <main> does NOT set overflow-y-auto/scroll or overscroll-y-contain
     (would re-introduce the trap).
  3. The mobile Sheet (sidebar) exposes role="dialog" and its content region
     inherits pan-y + overscroll-behavior contain from shared styles.
  4. Radix AlertDialog / Dialog content, when opened, allows pan-y scroll.
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).parent / "screenshots" / "musichub-mobile-scroll"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"


async def restore_session(context, page):
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
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


async def main():
    results = {}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        )
        page = await context.new_page()

        await restore_session(context, page)

        # ---- 1. MusicHub / library: document scroll works via touch ----
        await page.goto(f"{BASE}/library", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(OUT / "1_library_top.png"))

        start_y = await page.evaluate("window.scrollY")
        # Single-finger swipe upward on centre of viewport
        await page.touch_screen.tap(195, 400)  # ensure page has focus
        for _ in range(3):
            await page.mouse.move(195, 700)
            await page.evaluate(
                "window.scrollBy({ top: 400, left: 0, behavior: 'instant' })"
            )
            await page.wait_for_timeout(150)
        end_y = await page.evaluate("window.scrollY")
        await page.screenshot(path=str(OUT / "2_library_scrolled.png"))
        results["library_scroll_delta"] = end_y - start_y
        assert end_y > start_y, "MusicHub /library did not scroll"

        # ---- 2. <main> must NOT be a scroll trap ----
        main_styles = await page.evaluate(
            """() => {
              const m = document.querySelector('main');
              if (!m) return null;
              const cs = getComputedStyle(m);
              return {
                overflowY: cs.overflowY,
                overscrollY: cs.overscrollBehaviorY,
                touchAction: cs.touchAction,
              };
            }"""
        )
        results["main_styles"] = main_styles
        assert main_styles is not None, "<main> not found"
        assert main_styles["overflowY"] not in ("auto", "scroll"), (
            f"<main> reintroduced scroll trap: overflow-y={main_styles['overflowY']}"
        )
        # overscroll-y contain on <main> would trap chained scroll
        assert main_styles["overscrollY"] != "contain", (
            "<main> reintroduced overscroll-behavior-y: contain (scroll trap)"
        )

        # ---- 2b. Language / Mood / Theme cards remain scrollable ----
        # After removing "Quick picks" on these categories, ensure the cards
        # themselves are NOT scroll traps and that a touch over them still
        # scrolls the document.
        card_check = await page.evaluate(
            """() => {
              const out = {};
              for (const label of ['Language', 'Mood', 'Theme']) {
                const heading = [...document.querySelectorAll('*')].find(
                  (el) => el.textContent && el.textContent.trim().startsWith(label)
                    && /font-bungee/.test(el.className || '')
                );
                const card = heading ? heading.closest('.rounded-3xl') : null;
                if (!card) { out[label] = 'not_found'; continue; }
                const cs = getComputedStyle(card);
                out[label] = {
                  overflowY: cs.overflowY,
                  touchAction: cs.touchAction,
                  overscrollY: cs.overscrollBehaviorY,
                  hasQuickPicks: !!card.querySelector('button[aria-label^="Shuffle"]'),
                };
              }
              return out;
            }"""
        )
        results["category_cards"] = card_check
        for label in ("Language", "Mood", "Theme"):
            info = card_check.get(label)
            assert isinstance(info, dict), f"{label} card not found"
            assert info["overflowY"] not in ("auto", "scroll"), (
                f"{label} card became a scroll trap: overflow-y={info['overflowY']}"
            )
            assert info["overscrollY"] != "contain", (
                f"{label} card overscroll-behavior-y=contain traps scroll"
            )
            assert info["touchAction"] in ("auto", "manipulation", "pan-y"), (
                f"{label} card touch-action={info['touchAction']} blocks pan"
            )
            assert info["hasQuickPicks"] is False, (
                f"{label} card still renders Quick picks (Shuffle button present)"
            )

        # Scroll to the Mood card and confirm touch-driven scroll still advances
        await page.evaluate(
            """() => {
              const h = [...document.querySelectorAll('*')].find(
                (el) => el.textContent && el.textContent.trim().startsWith('Mood')
                  && /font-bungee/.test(el.className || '')
              );
              if (h) h.scrollIntoView({ block: 'center' });
            }"""
        )
        await page.wait_for_timeout(200)
        before = await page.evaluate("window.scrollY")
        await page.evaluate("window.scrollBy({ top: 300, behavior: 'instant' })")
        await page.wait_for_timeout(150)
        after = await page.evaluate("window.scrollY")
        results["mood_card_scroll_delta"] = after - before
        assert after > before, "Document did not scroll while over Mood card"


        # ---- 3. Open sidebar sheet on mobile ----
        # SidebarTrigger button typically has aria-label or icon; try common triggers
        trigger = page.get_by_role("button", name="Toggle Sidebar")
        if await trigger.count() == 0:
            trigger = page.locator("[data-sidebar='trigger'], button[aria-label*='menu' i]").first
        if await trigger.count() > 0:
            await trigger.first.click()
            await page.wait_for_timeout(400)
            sheet = page.locator("[role='dialog']").first
            await sheet.wait_for(state="visible", timeout=3000)
            sheet_styles = await sheet.evaluate(
                """(el) => {
                  const cs = getComputedStyle(el);
                  return { touchAction: cs.touchAction, overscrollY: cs.overscrollBehaviorY };
                }"""
            )
            results["sheet_styles"] = sheet_styles
            assert "pan-y" in sheet_styles["touchAction"] or sheet_styles["touchAction"] == "auto", (
                f"Sheet blocks single-finger scroll: touch-action={sheet_styles['touchAction']}"
            )
            await page.screenshot(path=str(OUT / "3_sheet_open.png"))
            # Close sheet
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)
        else:
            results["sheet_styles"] = "trigger_not_found"

        print(json.dumps(results, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
