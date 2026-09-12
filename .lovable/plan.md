# Make Store the complete shopping page

## What will change

- Make **Store** open directly on the full OG Coin Vault experience: wallet balance, custom coin amount, VIP, coin bundles, trust information, and checkout.
- Remove the current Items / OG Coins & VIP split so users do not have to switch views.
- Move the existing Store item catalogue into that same page, immediately above **Purchase history**.
- Keep the legacy coin-pack URL working by redirecting it to Store, and make checkout returns lead back to the unified Store page.

## End-to-end wiring

- Preserve card, Apple Pay, Google Pay, VIP, custom coin, and preset bundle checkout behavior.
- Preserve the 10-coin **OG SPORTS GUIDE ACCESS** purchase, ownership state, Telegram connection requirement, and invite claim flow in its new position.
- Keep ordinary Store-item checkout working in-place without sending users to another page.
- Refresh wallet, access, catalogue, and purchase-history data after successful actions.

## Boss controls

- Keep the existing Store admin screen as the source for adding, editing, ordering, hiding, and archiving catalogue items and categories.
- Add OG Coin pricing to the boss item editor so coin-priced items can be managed properly, while fiat-priced items continue using the existing payment checkout.
- Keep Coin Vault inline edit mode for coin packs and VIP content.

## Technical details

- Extract the catalogue and its checkout dialogs into a reusable section rendered by the Coin Vault page.
- Simplify `/store` to render the Coin Vault as its single canonical shopping experience.
- Preserve `/buy-coins` and old `view=coins` links as compatible redirects/inputs.
- Verify boss item changes reach the user catalogue, purchases select the correct payment method, and mobile layouts do not overflow.

## Verification

- Run type and build checks.
- Test Store on phone and desktop sizes.
- Verify VIP, custom amount, preset coin packs, fiat Store items, coin-priced Sports Guide access, Telegram claim states, Purchase History placement, and boss catalogue controls.
