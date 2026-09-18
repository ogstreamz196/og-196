# Four-level foul-language control

## What will change
- Replace the current five-position 18+ slider with four clear levels: **Clean, Mild, Strong, Savage**.
- Selecting **PG** immediately sets the level to Clean (zero) and disables foul language.
- Selecting **18+** immediately sets the level to Savage (maximum); users can then lower it to Mild or Strong for that track.
- Keep Nasheed strictly Clean regardless of the selected setting.

## Wiring
- Save levels from 0–3 instead of 1–5 and update the database range safely.
- Pass the selected level through track creation and editing without rounding it back to the old scale.
- Update lyric instructions so each level has an explicit profanity frequency target, with Savage demanding uncensored gutter-mouth language throughout.
- Ensure Clean always uses the PG lyric path and cannot inherit a stale foul-language setting.

## Verification
- Check PG → 0, 18+ → 3, and manual movement through levels 1 and 2.
- Verify generated requests carry the selected value and that the app builds successfully.
