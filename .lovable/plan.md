## Optimization plan (3 phases, behavior-preserving)

### Phase 1 — Accessibility (this turn)
- Replace `h-screen` with `h-dvh` in app-owned files (skip generated `ui/calendar.tsx`, `ui/sidebar.tsx`).
- Add `aria-label` to icon-only Buttons (`size="icon"`) missing accessible names.
- Audit headings: ensure each page has one `<h1>`; fix obvious skipped levels.
- Replace hardcoded color utilities (`text-gray-*`, `bg-white`) with design tokens where they appear in app components.

### Phase 2 — Performance
- Add `defaultPreloadStaleTime` / `gcTime` tuning on the shared QueryClient if not already set.
- Memoize hot list rows in `library.index.tsx` and `messenger.tsx` (`React.memo` + stable handlers).
- Add explicit `width`/`height` on `<img>` tags in `SongCard`, `CategoryCard`, hero, avatars to prevent CLS.
- Add `loading="lazy"` + `decoding="async"` to non-LCP images.
- Preload the LCP image on `/` via the route `head().links`.

### Phase 3 — Maintainability
- Continue prior refactor: extract `LibraryTabs`, `CommunityList`, `YoursList` from `library.index.tsx` (now ~1042 lines).
- Extract `MessengerComposer` and `MessageBubble` from `messenger.tsx`.
- Extract `BossPricingPanel` from `admin.index.tsx` if still inline.
- Consolidate duplicated signed-URL fetching into `useSignedUrl` hook (already partly done by `use-song-audio`).

### Out of scope
- No behavior changes, no API changes, no design-system color overhaul, no route reshuffles.
- Auto-generated files (`routeTree.gen.ts`, `src/integrations/supabase/*`) are not touched.

After each phase: typecheck + relevant smoke checks. Reply between phases so you can redirect if priorities shift.
