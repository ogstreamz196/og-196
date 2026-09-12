# Mobile readability and Store card polish

## Goal
Make Store cards easier to distinguish on dark screens and prevent tabs, labels, prices, and actions from overlapping across phone sizes.

## Changes
- Add a lighter, opaque Store-card surface token with clearer borders and shadows while preserving OG BOT’s dark blue/red identity.
- Change Store category controls to a wrapping multi-row layout so labels such as VIP and Random stay fully readable.
- Reflow narrow Store cards, coin packs, VIP pricing, totals, and actions onto new rows when horizontal space is limited.
- Apply shared mobile safeguards to repeated tab bars, action rows, headers, dialogs, and cards across user-facing pages.
- Keep existing purchase, VIP, Sports Guide, Telegram, MusicHUB, and Battle Zone behavior unchanged.

## Verification
- Check all main signed-in pages at iPhone SE, iPhone 14, and Pixel widths, including increased text scaling.
- Verify there is no horizontal page scroll, clipped text, overlapping controls, or inaccessible actions.
- Confirm Store tabs and cards remain readable and usable on desktop.

## Technical details
- Use existing semantic color tokens plus new Store-specific semantic surface tokens in the global theme.
- Prefer wrapping grids with `minmax(0, 1fr)`, `min-w-0`, and stacked mobile actions over horizontal scrolling or clipped labels.
- Extend the existing mobile overlap check to cover narrow widths and enlarged saved text settings where practical.
