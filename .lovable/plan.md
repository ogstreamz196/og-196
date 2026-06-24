# Optimization Pass

Goal: improve performance, maintainability, accessibility, and code hygiene without changing any user-visible behavior or design.

## Scope (moderate risk)

No folder reorgs, no route renames, no API shape changes. Routes, exports, and public component props stay stable. Extracted child components are co-located in `src/components/<feature>/` next to existing siblings.

## 1. Split the three largest route files

These three files are 1000+ lines each and dominate the bundle on first load.

- `src/routes/_authenticated/library.index.tsx` (1336 lines)
  - Extract `SongCardSkeleton`, `ShufflePromptsPanel`, `DescribeSongPanel`, `EmptyLibraryState`, `DeleteSongDialog` into `src/components/library/`.
  - Move helper functions (random prompt picker, filter/sort utils) to `src/lib/library-utils.ts`.
  - Route file becomes orchestration + data fetching only.

- `src/components/library/SongWorkspace.tsx` (1256 lines)
  - Split into `WorkspaceHeader`, `LyricsEditor`, `RenderControls`, `VersionList` siblings in same folder.
  - Move pure helpers to `src/lib/song-workspace-utils.ts`.

- `src/routes/_authenticated/buy-coins.index.tsx` (1008 lines)
  - Extract `PackGrid`, `PaymentMethodPicker`, `CheckoutSummary` into `src/components/buy-coins/`.

## 2. Performance

- Add `staleTime` to queries that currently default to 0 where data is stable (profile, settings, role, seeds) — typically 60s.
- Memoize derived lists in library/workspace with `useMemo` where they currently recompute on every keystroke.
- Lazy-load heavy admin-only components with `React.lazy` inside admin routes (PortalManager, MintCoinsPanel, AdminEditMode).
- Verify TanStack Router `defaultPreloadStaleTime: 0` is set (Query owns freshness).

## 3. Accessibility

Sweep for the common shadcn gaps:
- `aria-label` on every icon-only `<Button size="icon">` (shuffle, refresh, delete, close).
- Replace remaining `text-gray-*` / hardcoded color utilities with semantic tokens (`text-muted-foreground`, `text-foreground`).
- Ensure each route renders exactly one `<main>` (currently in `_authenticated` layout) and no duplicates inside leaves.
- Add `alt=""` to decorative images, descriptive `alt` to content images (song covers).

## 4. Clean implementation

- Remove unused imports flagged by the linter across the three big files.
- Consolidate duplicate seed/prompt arrays into the existing `src/lib/seeds.ts`.
- Tighten `any` types where trivially inferable (loader returns, query results).
- Delete dead code paths (commented-out blocks, unused state setters).

## Out of scope

- Schema changes, RLS edits, edge functions, auth flow.
- Visual redesign or copy changes.
- Renaming routes, files moved across feature folders, or changes to `src/integrations/supabase/*`.

## Verification

After each of the four sections: run typecheck + build, open the affected pages in the preview, confirm no visual diff.

## Technical notes

- Extractions use named exports and explicit prop types — no behavior changes.
- Code-splitting via `React.lazy` + `Suspense` only for admin subtrees so the public bundle shrinks without affecting authenticated-user perf.
- All new utility files are pure functions (no React, no side effects) to keep them tree-shakeable and testable.
