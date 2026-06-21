## What I found

Most of this is already half-built:

- `library.index.tsx` already maps the four cards (From scratch / From a memory / Dedication / With OG) to `setOpenFlow(...)` and opens `CreateSongDialog`. The buttons aren't broken — they open a Dialog. You asked for a side-sheet/drawer instead.
- `CreateSongDialog` already has per-flow copy and chip pickers for mood/genre/style/language/relationship.
- `OgBotWidget` exists (floating draggable orb that hides itself on `/messenger`) but is **not mounted anywhere**, so it's currently invisible.
- `OgChat` already persists history to `localStorage` and broadcasts updates across tabs, so widget ↔ messenger share memory in the same browser. Cross-device sync needs a DB-backed messages table.
- `user_preferences.foul_mouth` exists and is shared via DB, but defaults to `true` in both the migration and every `?? true` fallback in code. You want default = OFF.

## What I'll change

### 1. Library entry-point buttons → side sheet (drawer)
- Convert `CreateSongDialog` to use shadcn `Sheet` (right side, scroll inside). Keep all existing fields, chip sections and "Add more details" block — only the shell changes.
- Rename export to `CreateSongSheet` (keep a thin re-export named `CreateSongDialog` so nothing else breaks).
- Flows `scratch`, `memory`, `tribute` all open the sheet with their existing per-flow copy and the right relevant prompts (memory + tribute get the "Who it's for" relationship chips; scratch doesn't).

### 2. "With OG" button → opens the floating widget for free
- Remove the `messenger` branch from the sheet. The "With OG" card instead opens `OgBotWidget` in expanded state and seeds it with a starter prompt like "Let's co-write a song together — what's the vibe?".
- Exposed via a tiny `useOgWidget()` store (zustand-style with `useSyncExternalStore`) so any page can call `ogWidget.open({ seed })`.
- Already free of charge — `OgChat` calls the AI gateway, no coin deduction in that path.

### 3. Mount the widget on every authenticated page except /messenger
- Mount `<OgBotWidget />` inside `_authenticated/route.tsx` next to `<Outlet />`. The widget already self-hides when `pathname === "/messenger"`.

### 4. Shared memory + settings sync
- Add `og_messages` table (`id`, `user_id`, `role`, `content`, `created_at`) with RLS + GRANTs scoped to `auth.uid()`, plus realtime publication.
- Update `OgChat` to:
  - Load the last ~50 messages from `og_messages` on mount (fallback to localStorage if offline).
  - Insert each user + assistant message into `og_messages`.
  - Subscribe to `postgres_changes` so messenger and widget reflect new messages instantly (cross-device).
- `foul_mouth` is already DB-backed. Add a realtime subscription in `useFoulMouth` so toggling it in widget settings instantly updates messenger settings and vice versa.

### 5. Default foul-mouth = OFF
- Migration: `ALTER TABLE user_preferences ALTER COLUMN foul_mouth SET DEFAULT false;` and `UPDATE user_preferences SET foul_mouth = false WHERE foul_mouth IS NOT DISTINCT FROM true AND updated_at = created_at;` (only rows users never explicitly toggled — detected by no update since insert).
- Code: change every `?? true` fallback for `foul_mouth` to `?? false` (`use-foul-mouth.tsx`, `og-messenger.functions.ts`, and any persona helper that reads it).
- Users who already turned it ON keep it on.

### 6. Out of scope (ask if you want these too)
- Building a new settings UI for foul-mouth (a toggle already exists in `/settings`).
- Migrating existing localStorage chat history into the new `og_messages` table.

## Files touched
- `src/components/library/CreateSongDialog.tsx` → convert shell to `Sheet`, drop messenger flow.
- `src/routes/_authenticated/library.index.tsx` → "With OG" calls widget instead of opening sheet.
- `src/routes/_authenticated/route.tsx` → mount `<OgBotWidget />`.
- `src/components/messenger/OgBotWidget.tsx` → accept external open + seed via store.
- `src/components/messenger/OgChat.tsx` → DB-backed history + realtime subscribe.
- `src/hooks/use-foul-mouth.tsx` → default `false`, realtime subscribe.
- `src/lib/og-messenger.functions.ts` → default `false`.
- New: `src/stores/og-widget.ts`, migration for `og_messages` + `foul_mouth` default.
