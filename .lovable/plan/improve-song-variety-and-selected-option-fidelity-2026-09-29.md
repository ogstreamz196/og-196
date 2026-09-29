# Improve song variety and selected-option fidelity

## Changes
- Replace **Any voice** with **Mix voice** in the creation wizard and song editor.
- Make Mix voice request a deliberate mash-up of different lead voices, group vocals, alternating singers, and layered harmonies across sections.
- Pass the chosen voice through every generation and regeneration path.
- Strengthen lyric instructions to avoid recycled openings and clichés such as “this ain't no lullaby,” while varying intro type and first-line construction.
- Assign every selected style and language to explicit song sections so none are omitted.
- Improve minimum-length enforcement by generating enough structured lyric material, checking the result, and extending short drafts while preserving all chosen styles and languages.
- Reinforce the requested minimum duration in the final music-generation instructions.

## Verification
- Add focused tests for mixed-voice, style/language coverage, varied-intro, and minimum-length prompt rules where practical.
- Check the app build and relevant song-generation tests.

## Technical details
- Update the creation/editor labels and normalize older saved “Any voice” selections to Mix voice.
- Update both lyric-generation and music-generation request construction; no pricing, payments, or unrelated screens change.
