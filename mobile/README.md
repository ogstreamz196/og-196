# OG BOT phone apps

The Android and iPhone apps are a thin native shell around the published site
at <https://ogbot.co.uk>. Publishing the site updates both apps instantly —
no new app build and no store review for ordinary changes.

## What's here

- `capacitor.config.ts` (project root) — app name, app ID (`uk.co.ogbot.app`)
  and the site the shell loads.
- `mobile/www/index.html` — the offline fallback screen.
- `android/` — Android Studio project (build the APK / AAB here).
- `ios/` — Xcode project (needs a Mac and an Apple developer account).

## Build the Android app

1. Install Android Studio.
2. `bun run mobile:sync`
3. `bunx cap open android`
4. In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
   Signed release builds go through **Build → Generate Signed Bundle / APK**.

## Build the iPhone app

1. On a Mac with Xcode installed: `bun run mobile:sync`
2. `bunx cap open ios`
3. Set your signing team, then **Product → Archive** and upload to App Store
   Connect.

## After changing app name, icon or the site address

Edit `capacitor.config.ts`, then run `bun run mobile:sync`.
