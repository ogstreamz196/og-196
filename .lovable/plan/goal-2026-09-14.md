## Goal
Verify the existing payment webhook and make the creation-to-download flow match the new offer, then produce a new vertical promo video.

## App changes
- Keep song creation, lyrics, and rendering free; charge only at final full-track download.
- Give eligible new accounts 25 free OG credits, while preserving the two-accounts-per-device protection.
- Keep the final download choice at either 5 OG credits or a one-off 99p card payment.
- When a rendering track exposes playable audio, add it to the Library media player, attempt playback immediately, and show a toast explaining that the full file is still downloading. Its Play action will start listening and dismiss the toast.
- Preserve current completed-track, playlist, unlock, download, and payment-webhook behaviour.

## Payment verification
- Confirm the webhook event ledger, payment transaction history, configured pricing, and live-payment onboarding state.
- Validate the existing webhook’s 99p track-unlock path remains idempotent and payment-gated.

## Promo video
- Create an approximately 60-second 1080×1920 OG BOT video using the existing branded visuals and soundtrack.
- Promote 25 free credits, earning credits through OG Battle Zone, free creation/rendering, early listening while the master downloads, and the final 5-credit or 99p download choice.
- Exclude the global playlist.
- Render and verify duration, dimensions, audio, and file integrity.

## Technical details
- Update the new-user credit trigger and fallback bootstrap value together.
- Make early preview URLs available only to the track owner and only from the provider hosts already trusted by the callback.
- Register early playable tracks with the existing one-track-at-a-time playlist so previous audio pauses and normal media controls continue to work.
