## Privacy

- Collect only account-linking data and service records; never collect location, IP-derived geography, full device fingerprints, or page-by-page activity because Play Store privacy minimisation is a product requirement.

## Coin integrity

- Issue welcome and Battle rewards only through service-only atomic database functions because retries, concurrency, and client calls must not duplicate coins.
- Keep browser OAuth return separate from Android App Links and use a prebuilt, package-targeted intent anchor on the return page; Chrome requires a direct tap, and the installed APK must already handle /app-return.
- On the native Capacitor welcome screen show only the manual account form and footer D.EV Google entry; leave web OAuth unchanged so existing website access remains intact.
- Boss account deletion runs in an authenticated server function with a server-checked role and protected targets, because client-side role visibility must never authorize destructive actions.

## AI providers

- Share ordinary chat inference between the owner's `GEMINI_API_KEY` and `OPENAI_API_KEY`, with one cross-provider fallback only for 429/5xx failures; use `PERPLEXITY_API_KEY` only for live web facts and never use Lovable AI for end-user inference.
- Keep lyrics generation and audio transcription on Gemini because those flows use Gemini-specific media handling.

## Public track sharing

- Public share pages may serve only completed, public, revealed tracks through short-lived signed audio URLs, so private and hidden tracks cannot leak.
