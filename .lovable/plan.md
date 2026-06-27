# Refactor Plan

"Refactor the whole project" at this size (1,200+ line route files, dozens of admin pages, many Edge Functions) would balloon into hundreds of edits with real regression risk. Instead, I'll do a focused, behavior-preserving cleanup of the worst hotspots — the files most likely to keep biting us in future changes — and stop there.

## Scope (in)

1. **`src/routes/_authenticated/library.index.tsx`** (~1,300 lines)
   - Extract sub-components into `src/components/library/`:
     - `LibraryHero` (welcome + earn strip + dodgy logo)
     - `YoursTab` (search, list, empty state, delete)
     - `CommunityTab` (search, infinite scroll, empty state)
     - `MusicHubBuilder` (prompt chips + style pickers + generate button)
   - Move the community RPC query + realtime subscription into `src/hooks/use-community-songs.ts` and `use-library-realtime.ts`.
   - Route file becomes the composition shell only (~200 lines).

2. **`src/routes/_authenticated/messenger.tsx`**
   - Pull confirmation dialog + mode header into `src/components/messenger/MessengerModeSwitch.tsx`.
   - Keep `OgChat` / `CommunityRoom` mounting logic as-is.

3. **`src/components/SongCard.tsx`**
   - Split the signed-URL fetch + download handler into `src/hooks/use-song-audio.ts`.
   - Card becomes presentational.

4. **Shared utilities**
   - Consolidate the repeated "format duration / format coin amount / relative time" helpers scattered across `src/components/**` into `src/lib/format.ts`.
   - Replace duplicated `useState`+`useEffect` IntersectionObserver blocks (library community + any other infinite list) with a small `useInfiniteScrollSentinel(ref, { onHit, enabled })` hook.

5. **Dead code sweep**
   - Remove unused imports flagged by `tsgo` after the extractions.
   - Delete the orphaned `src/routes/_authenticated/admin.users-pro.tsx` redirect file (already merged into `/admin/users`) and update `admin.route-map.tsx` accordingly — keep the path working via the route auditor's allowlist, not a dead file.

## Scope (out — intentionally)

- No design, copy, color, or layout changes.
- No DB schema, RPC, RLS, or Edge Function changes.
- No changes to auth, payments, Telegram, Suno, or Stripe flows.
- No bulk rename or "tidy every file" pass — only the hotspots above.
- No test additions beyond keeping the existing Playwright regression green.

## Verification

After each extraction:
- `bunx tsgo --noEmit` clean.
- `bun run build` clean (route auditor + Vite build).
- Manual smoke in preview: open `/library` (both tabs), `/messenger` (both modes), play a track from a song card.

## Risks / Notes

- `library.index.tsx` holds a lot of co-located state; I'll lift state up only where a child genuinely needs it, and keep the rest local to avoid prop drilling.
- If any extraction would require changing a public hook signature used elsewhere, I'll stop and leave that file alone rather than cascade edits.
- Estimated diff: ~10–14 files touched, ~600 lines moved, ~0 lines of behavior change.
