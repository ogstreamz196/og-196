# Music-Hub Refactor Plan

Goal: same behavior, same design — cleaner module boundaries, less duplication, stricter types.

## 1. SongWorkspace split (`src/components/library/SongWorkspace.tsx`, 699 lines → ~200)

Create `src/components/library/song-workspace/`:

```text
song-workspace/
├── index.tsx                 # orchestrator, stage state, layout
├── StageStepper.tsx          # already a candidate; move out
├── LyricsStage.tsx           # stage 1 UI
├── PreviewStage.tsx          # stage 2 UI (generate + poll banner)
├── UnlockStage.tsx           # stage 3 UI (full unlock CTA)
├── VariationsCard.tsx        # variations list + basket
└── types.ts                  # Variation, Stage, Basket types
```

Extract hooks into `src/hooks/`:
- `use-song-generation.ts` — wraps `suno-generate` invocation + polling
- `use-variations.ts` — reveal, basket state, checkout queue
- `use-invoke-error.ts` — the `invokeError(err, fallback)` helper as a tiny util in `src/lib/invoke-error.ts`

## 2. Shared coin / identity / dev helpers

New files:
- `src/lib/coins.ts` — `fetchBalance(userId)`, `formatCoins(n)`, single source of `OG_COIN` symbol
- `src/hooks/use-coin-balance.ts` — subscribes via TanStack Query, replaces ad-hoc balance fetches
- `src/hooks/use-identity.ts` — merges `useDevMode` + display-name resolution so components stop re-implementing "show DEV vs username"

Update call sites:
- `AppShell`, `AppSidebar`, `OgChat`, `_authenticated/index.tsx`, `SongWorkspace`, admin pricing page.

## 3. Edge function cleanup (`supabase/functions/_shared/`)

New shared modules (Deno):
- `_shared/cors.ts` — single `corsHeaders` + `withCors(handler)` wrapper
- `_shared/supabase.ts` — `adminClient()` / `userClient(req)` factories
- `_shared/errors.ts` — `jsonError(status, msg)`, `jsonOk(data)`
- `_shared/coins.ts` — `deductOrRefund(userId, amount, reason)` wrapping the existing RPC + transaction insert pattern reused by `reveal-variation`, `unlock-full-song`, `suno-generate`

Refactor `reveal-variation`, `unlock-full-song`, `song-url`, `suno-generate`, `suno-callback`, `admin-mint-coins`, `admin-reprocess`, `generate-lyrics` to import from `_shared/*`. No behavior change — same status codes, same payloads.

## 4. Types & dead code

- Replace remaining `any` in `SongWorkspace`, `suno-callback`, `reveal-variation` with discriminated unions (`SunoClip`, `SongRow`, `RevealResult`).
- Remove unused imports & commented-out blocks flagged by `tsc --noEmit` after the split.
- Hoist magic numbers into `src/lib/constants.ts`: `PREVIEW_POLL_INTERVAL_MS`, `MAX_POLL_ATTEMPTS`, `DEFAULT_SAMPLE_SECONDS`.
- Tighten `AppSettings` type so optional admin keys aren't `| undefined` at every use site.

## Out of scope (preserved as-is)

- Visual design, copy, color tokens.
- Pricing math and RPC contracts.
- Migrations and DB schema.
- Auth gates and route structure.

## Risk & verification

- After each of the 4 sections: `tsc --noEmit` via the harness build, plus a manual click-through of: generate preview → reveal variation → add to basket → checkout → unlock full song.
- Edge functions deployed together at the end of section 3 so callbacks stay consistent.
- No public API / RPC signatures change; the client-server contracts are untouched.

Proceeding section-by-section in that order keeps each PR-sized change reviewable and bisectable.