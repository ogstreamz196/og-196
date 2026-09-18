# Fix Step 3 mobile scrolling

## Changes
- Make the creation wizard a full-height, phone-friendly surface using one continuous page scroll instead of nested popup scroll areas.
- Let Step 3 language choices and all option panels expand naturally into that main scroll.
- Keep the progress header, actions, safe-area spacing, and existing desktop dialog behaviour polished and usable.
- Reset the scroll position when moving between steps so every stage starts at the top.

## Verification
- Test Step 3 at the current phone size, including swiping over language choices and reaching the Create/Global controls.
- Check desktop behaviour and confirm there is no horizontal overflow or build error.
