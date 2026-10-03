## Privacy

- Collect only account-linking data and service records; never collect location, IP-derived geography, full device fingerprints, or page-by-page activity because Play Store privacy minimisation is a product requirement.

## Coin integrity

- Issue welcome and Battle rewards only through service-only atomic database functions because retries, concurrency, and client calls must not duplicate coins.
- Assign yearly VIP IDs through the service-only database function as `OG` plus the uppercase username, and synchronize the ID when that username changes.
- Keep browser OAuth return separate from Android App Links and use a prebuilt, package-targeted intent anchor on the return page; Chrome requires a direct tap, and the installed APK must already handle /app-return.
- On the native Capacitor welcome screen show only the manual account form (no Google or Apple entry at all); leave web OAuth unchanged so existing website access remains intact.
- Boss account deletion runs in an authenticated server function with a server-checked role and protected targets, because client-side role visibility must never authorize destructive actions.

## AI providers

- Share ordinary chat inference between the owner's `GEMINI_API_KEY` and `OPENAI_API_KEY`; on 429/402/401/403/5xx cascade to free text-only tiers (Groq, Cerebras, Mistral, OpenRouter when keyed, then keyless Pollinations) so chat never dies when premium quota runs out; use `PERPLEXITY_API_KEY` only for live web facts and never use Lovable AI for end-user inference.
- Keep lyrics generation and audio transcription on Gemini because those flows use Gemini-specific media handling.
- `GEMINI_BACKUP_API_KEY` is the owner's paid emergency key: use it only for lyrics and image edits, one attempt, after the primary key returns 429/5xx — never for ordinary chat, because it costs real money.
- Battle Zone learns slang via the service-only `learn_battle_words` function (words only, no user ids, slur blocklist) and feeds popular words into the foul prompt.

## Public track sharing

- Public share pages may serve only completed, public, revealed tracks through short-lived signed audio URLs, so private and hidden tracks cannot leak.

## Library playback

- The shared playlist controller exclusively switches tracks and pauses the previous audio element, preventing overlapping playback across rows and takes.

## Generation recovery

- Failed music jobs use database-claimed, bounded background retries that recover an existing provider task before resubmitting the saved payload, preventing duplicate work or coin charges.

## Chat image edits

- Private-chat image edits charge through the service-only consume_chat_image_edit function (one free slot per rolling window, then coins) and refund on failure, so retries cannot double-charge; edits use Gemini image first, OpenAI fallback only on 429/5xx.
