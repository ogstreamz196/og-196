## Goal
Rename `/buy-coins` → `/store`, polish into an arcade storefront, and give the boss a full CMS to add unlimited items across three categories: **Coins**, **Subscriptions**, and **Random Items** — each item auto-syncs to Stripe and checks out through the existing embedded flow.

## Database (one migration)
- `store_categories` — `slug` (coins|subscriptions|items|custom), `label`, `sort_order`, `active`
- `store_items` — `id`, `category_id`, `name`, `description`, `image_url`, `price_cents`, `currency`, `recurring_interval` (null|month|year), `stripe_price_id` (lookup key), `stock` (nullable = unlimited), `stock_sold`, `coin_reward` (nullable), `perk_slug` (nullable, e.g. `vip_badge`, `role:og_bot`), `rarity` (common|rare|epic|legendary), `sort_order`, `active`, timestamps
- RLS: `SELECT` for `authenticated` on `active=true`; `ALL` for boss/admin via `has_role`; `service_role` full
- Seed existing coin packs + VIP into rows so nothing breaks

## Server functions (`src/lib/store.functions.ts`)
- `listStoreCatalog()` — public read, grouped by category
- `upsertStoreItem({ ... })` — boss-only, calls `stripe.products.create/update` + `stripe.prices.create` with `lookup_key = <item slug>`, stores id
- `deleteStoreItem(id)` — boss-only, archives Stripe price + soft-deletes row
- `purchaseStoreItem({ itemId })` — extends `createCheckoutSession` with stock check + item metadata (`item_id`, `coin_reward`, `perk_slug`)

## Webhook update
Extend `payments/webhook.ts` `checkout.session.completed` handler:
1. Decrement `stock_sold`
2. If `coin_reward` → mint coins via existing RPC
3. If `perk_slug` starts `role:` → grant user_role
4. Existing VIP/coin-pack logic preserved

## UI
### Storefront `/store` (rename route)
- Sticky wallet balance bar (existing)
- Category tabs (Coins • Subscriptions • Random Items)
- Arcade card grid: rarity-colored border + flame aura, price pill, coin-reward pill, stock badge ("3 left" / "Sold out"), Buy button opens existing embedded Stripe modal
- Keep Custom Amount + Go VIP CTAs at top

### Admin `/admin/store` (new route)
- Boss-gated (existing `useRole().isBoss`)
- CRUD table + drawer form:
  - Category picker, name, description, image upload, price, currency, one-time/monthly/yearly toggle, stock, coin_reward, perk_slug, rarity, sort_order, active
- "Sync to Stripe" status pill per row
- Category manager (add/rename/reorder)
- Link from admin index

## Files touched
- New: migration, `src/lib/store.functions.ts`, `src/routes/_authenticated/store.index.tsx`, `src/routes/_authenticated/admin.store.tsx`, `src/components/store/StoreItemCard.tsx`, `src/components/admin/StoreItemForm.tsx`
- Edit: `buy-coins.index.tsx` → thin redirect to `/store`; `payments/webhook.ts` (item handler); `AppSidebar`/`MobileBottomNav` label "Store"; admin index link

## Out of scope
- Physical shipping / addresses
- Refund UI (hidden per prior memory)
- Multi-currency conversion (uses row's currency verbatim)