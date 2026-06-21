# Full-Sweep Refactor Plan

Goal: smaller files, fewer copies of the same logic, and a clearer client/server boundary — with no behavioral or visual change.

## 1. Component splits (large files → focused pieces)

Hottest files broken into folders. Each parent becomes a thin orchestrator.

- `routes/_authenticated/admin.users.tsx` (643 LOC)
  → `components/admin/users/{UsersTable, UserRow, UserFilters, UserActions}.tsx`
- `routes/portal.$slug.tsx` (634 LOC)
  → `components/portal/{PortalHero, PortalSections, PortalFooter}.tsx` + `lib/portal-data.functions.ts`
- `routes/welcome.tsx` (596 LOC)
  → `components/welcome/{Hero, FeatureGrid, EconomySection, CTASection}.tsx`
- `components/messenger/OgChat.tsx` (616 LOC)
  → `components/messenger/chat/{MessageList, Composer, ChatHeader}.tsx` + `hooks/use-og-chat.tsx`
- `routes/_authenticated/admin.index.tsx`, `library.index.tsx`, `library.$songId.tsx`, `settings.tsx`, `developer.tsx`, `buy-coins.index.tsx`
  → extract section components into `components/<route>/` siblings; route file keeps loader + composition only.
- `components/admin/{PortalManager, AdminEditMode, MintCoinsPanel, BulkReconcilePanel, WidgetAccessAudit}.tsx`
  → split form/table/dialog subcomponents per file.

UI primitives in `components/ui/*` (sidebar, chart, carousel, menubar) are left alone — they are shadcn vendored files.

## 2. Shared hooks & lib consolidation

- New `hooks/use-coin-balance.tsx` — single source for balance reads (currently duplicated in buy-coins, settings, admin, og-widget).
- New `hooks/use-admin-action.tsx` — wraps the `useMutation` + toast + `invalidateQueries` pattern repeated across admin panels.
- New `lib/format.ts` — `formatCoins`, `formatDate`, `formatRelative`, `truncate` (replace ad-hoc inline formatters).
- New `lib/query-keys.ts` — central typed query-key factory; replace string-literal keys.
- Move `og-persona.ts` constants → `lib/og/persona.ts`; split runtime helpers out of the 242-LOC file.
- Collapse `stripe.ts` + `stripe.server.ts` boundaries: keep `stripe.server.ts` as-is, move client-only helpers into `lib/stripe-client.ts`.

## 3. Server functions & edge cleanup

- Edge functions `reveal-variation`, `song-url`, `unlock-full-song`, `suno-generate`, `suno-callback`, `admin-mint-coins`, `admin-reprocess`, `generate-lyrics` all currently re-declare CORS + Supabase clients. The `_shared/{cors,clients}.ts` helpers already exist — finish migrating every function to use them, delete the local copies.
- Standardize edge-function response helper: `_shared/respond.ts` with `ok()`, `fail(status, code, msg)`.
- Standardize auth check: `_shared/require-user.ts` returning `{ user, supabase }` or throwing a 401 Response.
- TanStack server functions: ensure none statically import `client.server`; audit `*.functions.ts` for top-level admin imports and move into handler bodies via `await import(...)`.
- Centralize `invoke-error` parsing — already present, route every `supabase.functions.invoke` call through it; remove inline try/catch boilerplate.

## 4. Types & dead code

- New `types/` barrel: `types/{song, coin, profile, og-bot}.ts`. Replace duplicated inline interfaces (Song, Variation, Profile, CoinTransaction repeated across 8+ files) with imports.
- Delete unused exports flagged by a `ts-prune`-style scan (we will run it as part of the refactor).
- Remove now-unused legacy files after splits land (e.g. old monolithic component bodies, the duplicate `Blobs` once `WelcomeBackdrop` is wired everywhere — already partly done).
- Strip dev-only `console.log`s left in production paths (keep `console.error`).
- Tighten `any` usages flagged in `routes/_authenticated/*` and `components/admin/*` to concrete types from the new barrels.

## 5. Verification

After each phase:
- Build passes (typecheck + Vite).
- `bunx vitest run` for `generation-watch.test.ts` and `widget-visibility.test.ts`.
- Smoke routes: `/`, `/welcome`, `/buy-coins`, `/library`, `/admin/users`, `/portal/$slug` — visual diff via preview.

## Risk

High — full restructure touches ~40 files. Behavior preserved by keeping every extracted component a pure move (no prop shape changes), and every shared hook a drop-in replacement returning the same data. No DB, RLS, or auth changes. No design changes.

## Out of scope

- Visual / design changes (theme repaint already shipped).
- New features.
- Schema / RLS / migrations.
- UI primitive rewrites (`components/ui/*`).

## Order of execution

1. Shared lib (`format`, `query-keys`, `types/*`, hooks) — no consumers change yet.
2. Edge function `_shared` migration — backend isolated.
3. Component splits, one route at a time, verified after each.
4. Dead-code sweep last, once imports have settled.
