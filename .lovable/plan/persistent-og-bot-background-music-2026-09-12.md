# Persistent OG BOT background music

## Goal
Play the same OG BOT promo track continuously while visitors move between pages.

## Implementation
- Add one site-wide audio player at the app root so page navigation does not recreate or restart it.
- Use the uploaded `OG_PROMO.mp3` track, loop it continuously, and remember play/mute and playback position across reloads.
- Respect browser rules: try autoplay, then show a compact play control when a phone or browser requires the visitor's first tap.
- Pause background music whenever a user starts a library track, beat, or other media; allow the background track to resume explicitly without overlapping audio.
- Add accessible play/mute controls that remain reachable without covering mobile navigation or iPhone safe areas.

## Verification
- Check first-visit behavior and page-to-page continuity on desktop and iPhone-sized screens.
- Confirm another track pauses the background music and no two tracks overlap.
- Confirm production build status remains healthy.
