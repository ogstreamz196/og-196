## Goal
Redesign the OG Coins Store and let dev/admin override **label, description, coins, price (£), and 2× bonus** per pack — with changes affecting both the display *and* the actual Stripe charge.

## 1. Backend — persistent overrides
- Extend `parseOverride` (`site_content`-backed) to carry `priceCents`, `coins`, `bonus` alongside the existing `label`/`description`.
- Keep the canonical `COIN_PACKS` in `src/lib/coin-packs.ts` as the floor: bundleId, priceId, default coins/price.
- New server fn `applyPackOverride(bundleId)` reads the matching `site_content` row server-side and merges with `COIN_PACKS[bundleId]` to produce the **effective** pack used at checkout.

## 2. Server checkout (full override)
- `createCoinCheckoutSession` switches from static `price: <stripePrice.id>` to `price_data` whenever an override changes `priceCents` or `coins`. Falls back to the cached Stripe `lookup_key` price when no override exists.
- Webhook (`/api/public/payments/webhook`) credits coins from session metadata (already does) — we add the *effective* coins/bonus into that metadata so credit math stays correct.

## 3. Admin write path
- New protected server fn `setPackOverride({ bundleId, fields })` gated by `has_role('admin')` writing to `site_content`. Existing client `useSetSiteContent` keeps working for label/description but admin-only fields use the new fn so non-admins can't tamper from the browser.

## 4. UI rework
Reorganized into 4 clean stacked sections, consistent card chrome (`rounded-3xl border border-border bg-card`), single header pattern (icon · eyebrow · title · subtitle):

```text
┌────────────────────────────────────────────────────────┐
│  HERO              [Balance pill]   [Edit toggle ●]    │  ← compact
├────────────────────────────────────────────────────────┤
│  LIVE ECONOMY  (CirculatingCoins, unchanged)           │
├────────────────────────────────────────────────────────┤
│  PACKS  · 4-up grid, every card identical chrome       │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│   │ Mini   │ │Starter │ │Power ★ │ │ Pro ♛  │          │
│   │ 50 ⟶100│ │100⟶200 │ │240⟶480 │ │600⟶1200│          │
│   │ £4.99  │ │ £9.99  │ │£19.99  │ │ £39.99 │          │
│   └────────┘ └────────┘ └────────┘ └────────┘          │
│  CUSTOM PACK row underneath                            │
├────────────────────────────────────────────────────────┤
│  VIP   (yearly plan card — same chrome)                │
└────────────────────────────────────────────────────────┘
```

Per-card edit affordance when edit mode is on:
- Tiny pencil icon next to **each** editable field (label, description, coins, £, 2× bonus toggle).
- Click → inline input replaces the value, ✓/✗ commit/cancel.
- Saved value writes through `setPackOverride` and optimistically updates the card.
- Saved badge briefly flashes ("Saved · syncs to checkout").

## 5. Edit toggle UX
- A single dev-only toggle in the hero ("Edit mode") replaces the `?edit=1` URL param flow (still respected for shareable links).
- When ON, every editable field shows the pencil; when OFF, view-only.

## Technical notes (dev-facing)
- New columns in `site_content`? No — single JSON blob per pack at key `buyCoins.pack.<bundleId>.override`.
- Stripe `price_data` requires `currency` + `unit_amount` + `product_data.name`; we reuse the existing Stripe product (looked up once) and only override `unit_amount`.
- Effective pack is computed identically on client (for display) and server (for charge) by sharing `applyOverride()` in `src/lib/coin-packs.ts`.
- Custom pack and VIP pricing stay locked to current behavior unless explicitly added later.

## Out of scope
- Per-currency overrides (still GBP).
- Editing VIP / custom-pack pricing (can extend the same pattern later).
- Changing the Stripe catalog itself — overrides live in `site_content` only.
