## Goal
Apply a cohesive premium pass across the whole app using a Midnight Indigo palette at medium density (3/5). Improve spacing rhythm, responsive behavior, loading/empty/error states, and visual polish — without changing business logic.

## Creative direction
- **Palette (tokens in `src/styles.css`)**
  - `--background: oklch(0.12 0.04 270)` (deep navy `#0a0a1a` feel)
  - `--card / --popover: oklch(0.17 0.05 268)` (`#141432`)
  - `--muted / --secondary: oklch(0.22 0.07 268)` (`#1e1e5a`)
  - `--primary: oklch(0.58 0.22 274)` (electric indigo `#4f46e5`)
  - `--primary-glow: oklch(0.72 0.20 280)`
  - `--accent: oklch(0.75 0.18 295)` (violet highlight)
  - `--ring: var(--primary)`; refine `--border` to a low-opacity indigo
  - New gradients: `--gradient-brand`, `--gradient-surface`, `--gradient-aurora`
  - New shadows: `--shadow-glow` (indigo bloom), `--shadow-elevated`
- **Typography**: keep current display + body, tighten tracking on h1/h2, use `text-balance`/`text-pretty`.
- **Motion**: standardize `fade-in`, `scale-in`, `hover-scale`; add a subtle aurora background blob behind hero areas.

## Scope of changes (UI/presentation only)
1. **Design tokens** — `src/styles.css`
   - Rewrite color tokens for Midnight Indigo (light + dark).
   - Add gradient + shadow tokens, `bg-gradient-brand`, `bg-gradient-surface`, `shadow-glow` utilities via `@utility`.
2. **App shell** — `src/components/layout/AppShell.tsx`, `AppSidebar.tsx`, `WelcomeBackdrop.tsx`
   - Sidebar: refine active state (indigo pill + glow), consistent 12/16/24 spacing, better mobile sheet behavior.
   - Top bar: backdrop blur, subtle border, coin balance polished pill.
   - Add ambient aurora gradient backdrop (very subtle, fixed, behind content).
3. **Home / dashboard** — `src/routes/_authenticated/index.tsx` + `src/components/home/*`
   - HomeHero: stronger gradient text, breathing-room padding, responsive clamp sizes.
   - HubCard / FeatureGrid: unified card recipe (glass surface, hover lift, focus ring), 1/2/3 col responsive grid.
   - RecentCreations / CoinsCta: skeleton loading, empty state illustration text, consistent radius.
4. **Music hub** — `src/routes/_authenticated/library.index.tsx`
   - Keep current structure; tighten spacing scale, align category cards to a uniform height, improve chip wrap + touch targets, add skeletons during generate, disabled-state clarity, success toast polish.
5. **Auth + welcome** — `src/routes/auth.tsx`, `src/routes/welcome.tsx`
   - Centered card on aurora backdrop, consistent button hierarchy, mobile-safe paddings.
6. **Shared primitives** — light variant tweaks only
   - `button.tsx`: add `premium` variant (gradient + glow on hover). Existing variants untouched.
   - `card.tsx`: add `glass` className recipe via utility (no API change).
   - `skeleton.tsx`: indigo shimmer.

## Out of scope
- No DB, server function, edge function, auth, or business-logic changes.
- No new routes or features.
- No copy/content rewrites beyond microcopy on empty/error states.

## Verification
- Visual check at desktop (1440), tablet (820), mobile (390) via `browser--view_preview`.
- Confirm no hardcoded color classes were added (`text-white`, `bg-black`, hex literals).
- Confirm dark mode is the default and contrast passes on primary surfaces.

## Technical notes
- All colors via semantic tokens; no hex in components.
- Use `clamp()` for hero typography; use `min-w-0` + `truncate` on flex rows with mixed content (per responsive-layout guidance).
- Animations reuse existing keyframes in `styles.css`/Tailwind config; only add `aurora-pan` if needed.
