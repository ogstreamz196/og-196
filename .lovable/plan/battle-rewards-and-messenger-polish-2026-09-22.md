# Battle rewards and Messenger polish

## What will change
- Make Battle Zone rewards quality-based and varied: random chat receives nothing, weak/generic insults receive nothing, and stronger original insults draw from progressively larger reward ranges.
- Preserve and credit the exact displayed fraction of an OG Coin instead of rounding it at battle payout.
- Keep repeat/spam protection and show clear per-message reward feedback when a roast earns coins.
- Redesign both private Messenger and Battle Zone for phones: tighter header and controls, smaller smooth system typography, denser message rows, compact avatars/bubbles, cleaner composer, and more visible conversation history.
- Add restrained message-entry and reward animations with reduced-motion support.

## Technical details
- Update the Battle Zone scorer/calibration and its tests so quality bands determine weighted random fractional drops, while non-roast/random messages always return zero.
- Update coin storage and crediting safely where needed to support exact decimal balances and ledger amounts without breaking purchases or existing whole-coin balances.
- Adjust Messenger layout components and the page shell using existing design tokens and controls.
- Verify reward tests, current build health, and phone rendering/scrolling at 411×733.
