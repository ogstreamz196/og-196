# Fix Battle Zone coin rewards

## Changes
- Make the roast judge distinguish normal chat from actual insults without requiring every insult to be exceptional.
- Add a reliable local fallback so valid insults can still earn when the AI judge fails or returns an unusably low score.
- Keep random chat, questions, repeated lines, and empty messages at zero.
- Preserve randomized fractional rewards, with stronger and more original insults earning higher ranges.
- Add focused tests covering the recent no-reward examples and verify the purse/payout flow.

## Technical details
- Adjust the score calibration in the authenticated Battle Zone server function.
- Keep rewards recorded in tenths and paid exactly as decimal OG Coins through the existing secure payout function.
- Validate with unit tests, current backend records, and the preview build.
