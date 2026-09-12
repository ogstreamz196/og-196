# TV HUB

## Build
- Add a full-width **TV HUB** card directly below the existing MusicHUB and OG Bot cards on Home.
- Create a protected `/tv-hub` page with a cinematic, responsive IPTV-style interface.
- Start with a credential prompt for server URL, username, and password; keep real authentication disconnected for later.
- Include a clearly labelled temporary demo bypass that opens populated demo TV, Movies, and Series sections.
- Provide a working demo video player with play/pause, volume, seeking, fullscreen, channel selection, search, favourites, and programme details.
- Show a now/next EPG timeline where schedule data is available and a clear unavailable state otherwise.

## Integration
- Add TV HUB to the app page title map and sidebar while preserving existing Music, OG Bot, Store, and mobile navigation behavior.
- Keep credentials in page state only; do not save or transmit them.
- Use semantic design tokens and existing controls, with phone-safe scrolling and non-overlapping layouts.

## Verification
- Check the Home card links to TV HUB.
- Test the login prompt and demo bypass.
- Test TV, Movies, Series, search, channel selection, EPG, player controls, and phone/desktop layouts.
- Confirm the current build and browser console have no errors.
