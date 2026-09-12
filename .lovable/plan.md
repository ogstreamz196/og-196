# Merge Store and Coins

## What will change
- Make **Store** the single shopping destination.
- Add clear **Items** and **OG Coins & VIP** tabs so the existing product catalog and coin checkout remain easy to use.
- Rename the mobile bottom navigation item from **Coins** to **Store** and send it to `/store`.
- Keep old `/buy-coins` links and checkout return URLs working by forwarding shoppers into the merged Store.

## Technical details
- Extract the existing coin-vault screen into a reusable Store section without changing its purchase, VIP, admin-edit, balance, or history logic.
- Compose the existing merchandise catalog and coin section under the `/store` route.
- Preserve `/buy-coins/return` for payment reconciliation and redirect its completion action back to `/store`.
- Add complete Store page metadata and verify mobile navigation, tab switching, old-link compatibility, and checkout entry states.
