## Privacy

- Collect only account-linking data and service records; never collect location, IP-derived geography, full device fingerprints, or page-by-page activity because Play Store privacy minimisation is a product requirement.

## Coin integrity

- Issue welcome and Battle rewards only through service-only atomic database functions because retries, concurrency, and client calls must not duplicate coins.
- Keep browser OAuth return separate from Android App Links and use a prebuilt, package-targeted intent anchor on the return page; Chrome requires a direct tap, and the installed APK must already handle /app-return.
- On the native Capacitor welcome screen show only the manual account form and footer D.EV Google entry; leave web OAuth unchanged so existing website access remains intact.
- Boss account deletion runs in an authenticated server function with a server-checked role and protected targets, because client-side role visibility must never authorize destructive actions.

## AI provider

- Route all app AI inference through the owner's `GEMINI_API_KEY` with no Lovable AI fallback, so end-user AI activity never consumes Lovable AI credits.