# Regression: Loner Mode never posts to OG Community

**Bug:** Typing a message in OG Bot Loner Mode on mobile briefly raised a
"Posted to OG Community" toast because a legacy `shareLive` localStorage flag
defaulted ON when Telegram was linked, overriding the page-level mode toggle.

**Fix:** `OgChat` now forces `shareLive: false` + `forcePrivate: true` when
routing messages. Loner Mode is page-scoped: the only way to post to Community
is to switch the header toggle, which renders `<CommunityRoom />` instead of
`<OgChat />`.

## How the regression test works

The Playwright script under `tests/e2e/messenger-loner-no-community-toast.py`
runs in two viewports (mobile 390×780 and desktop 1280×900). For each:

1. Restore the injected Supabase session into `localStorage` on the localhost
   origin.
2. Force `messenger_mode = 'loner'` and clear the `og-bot-share-live` legacy
   flag.
3. Navigate to `/messenger`, wait for the Loner composer to mount.
4. Type "hello loner" and submit.
5. Watch for any toast text matching `/Posted to OG Community/i` for 3 seconds.
   The test FAILS if such a toast appears.
6. Capture a screenshot to `/tmp/browser/loner-toast/<viewport>.png`.

Run with:

```bash
python3 tests/e2e/messenger-loner-no-community-toast.py
```

The exit code is non-zero on regression.
