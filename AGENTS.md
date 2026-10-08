## Privacy

- Collect only account-linking data and service records; never collect location, IP-derived geography, full device fingerprints, or page-by-page activity because Play Store privacy minimisation is a product requirement.

## Coin integrity

- Owner track purchases use an authenticated server function and service-only atomic purchase RPC; database entitlement triggers reveal bonus siblings on payment or late insertion, preventing duplicate charges and browser-dependent grants.

- Issue welcome and Battle rewards only through service-only atomic database functions because retries, concurrency, and client calls must not duplicate coins.
- Assign yearly VIP IDs through the service-only database function as `OG` plus the uppercase username, and synchronize the ID when that username changes.
- Keep browser OAuth return separate from Android App Links and use a prebuilt, package-targeted intent anchor on the return page; Chrome requires a direct tap, and the installed APK must already handle /app-return.
- On the native Capacitor welcome screen show only the manual account form (no Google or Apple entry at all); leave web OAuth unchanged so existing website access remains intact.
- Boss account deletion runs in an authenticated server function with a server-checked role and protected targets, because client-side role visibility must never authorize destructive actions.

## AI providers

- Lyric intensity and the OG dictionary are enforced in the songwriter prompt only; never reject non-empty provider lyrics for profanity density, because post-check rejections exhausted the time budget and failed songs.
- Preserve submitted music lyrics on provider moderation rejection and return the rejection without automatic word substitutions; the selected explicit level must not silently become a radio edit.

- Ordinary text chat goes to keyed free tiers first (Groq, Pollinations, OpenRouter), with paid Gemini first only for media or heuristic "pro" questions and otherwise as fallback when free tiers fail, to save paid credits; there is no Boss toggle. Use `PERPLEXITY_API_KEY` only for live web facts and never use Lovable AI for end-user inference. With Foul Mouth on, only the free model that passed the live swearing test (OpenRouter nemotron-3-super) is used before Gemini, because Groq and Pollinations stay too polite.
- Lyrics run on free keys first, then Gemini (primary key, then backup key across several models); OpenAI is not used anywhere, because the owner removed it.
- `GEMINI_BACKUP_API_KEY` is the owner's paid emergency key: use it only for lyrics and image edits, after the primary key fails (401/403/404/429/5xx) — never for ordinary chat, because it costs real money.
- Battle Zone learns slang via the service-only `learn_battle_words` function (words only, no user ids, slur blocklist) and feeds popular words into the foul prompt.

## Public track sharing

- Public share pages may serve only completed, public, revealed tracks through short-lived signed audio URLs, so private and hidden tracks cannot leak.

## Library playback

- The shared playlist controller exclusively switches tracks and pauses the previous audio element, preventing overlapping playback across rows and takes.

## Generation recovery

- Failed music jobs use database-claimed, bounded background retries that recover an existing provider task before resubmitting the saved payload, preventing duplicate work or coin charges.

## Chat image edits

- Private-chat image edits charge through the service-only consume_chat_image_edit function (one free slot per rolling window, then coins) and refund on failure, so retries cannot double-charge; edits use Gemini image first, then the Gemini backup key only.

## Sports Guide

- Sports Guide posts are mirrored from the Telegram sports group by the existing bot webhook into a database table and read only by owners of the Sports Guide store item, so the in-app page is the paid product rather than a Telegram invite.

## Bot catchphrases

- Mount the browser installation banner before the route outlet and gate its event listener on Capacitor native/standalone detection; keep it in page flow so it cannot cover Android or web navigation.

- Telegram and web/in-app OG Bot replies take openers/closers from the shared service-only catchphrase bank with per-user unseen rotation and background free-tier refills, so greeting banter costs no premium tokens; Battle Zone stays freshly generated each message.
