# Export & Port Guide

Everything you need to lift this project into a fresh Lovable workspace
(with a connected Google account) and rebuild it cleanly.

---

## 1. Where the seeds live

All seed data — taxonomies, presets, example chips, persona, learning
dictionaries — is registered in **one place**:

```
src/lib/seeds.ts
```

That file either defines each seed directly OR re-exports it from its
canonical home. The full list:

| Seed                             | Canonical file                                      |
| -------------------------------- | --------------------------------------------------- |
| OG Bot persona + quick-starts    | `src/lib/og-persona.ts`                             |
| System-prompt builder            | `src/lib/og-persona.ts` (`buildSystemPrompt`)       |
| Insult learner seed dictionary   | `src/lib/insult-learner.ts`                         |
| Song moods / genres / styles     | `src/lib/seeds.ts`                                  |
| Song relationship / language     | `src/lib/seeds.ts`                                  |
| Song themes                      | `src/lib/seeds.ts`                                  |
| Song one-tap presets             | `src/lib/seeds.ts` (`SONG_PRESETS`)                 |
| Library "Describe" example chips | `src/lib/seeds.ts` (`LIBRARY_DESCRIBE_CHIPS`)       |
| Database schema + RLS            | `supabase/migrations/`                              |

If you add new seed data, add it to `src/lib/seeds.ts` (or re-export
from there) so this list stays true.

---

## 2. Exporting the project

1. **Code** — Lovable → ⋯ menu → **Connect to GitHub**, then push. The
   repo is self-contained; no hidden Lovable-only files are needed.
2. **Database** — Cloud tab → Database → Tables → download each table
   as CSV. (Full `pg_dump` is not exposed on Lovable Cloud.)
3. **Secrets** — list with the Secrets panel; you'll re-enter them in
   the new workspace (they aren't bundled with code).
4. **Storage assets** — public R2/Supabase Storage URLs in
   `src/assets/*.asset.json` keep working from any workspace.

---

## 3. Perfect prompt for a fresh Lovable workspace

Paste this into the new workspace's first message **after** you've
connected Google (so the Google auth provider is already wired up).

> Replace `<GITHUB_REPO_URL>` and `<CSV_BUNDLE_URL>` first.

```
Bootstrap a TanStack Start + Tailwind v4 + Lovable Cloud project from
this codebase: <GITHUB_REPO_URL>.

Tech contract — do not deviate:
- TanStack Start (file-based routing under src/routes/, never src/pages/).
- Tailwind v4 (CSS-first, tokens in src/styles.css under @theme, no
  tailwind.config.js).
- Lovable Cloud for DB, auth, storage, edge functions.
- Server logic in createServerFn (`@tanstack/react-start`), not Supabase
  Edge Functions, unless the route is a public webhook / cron under
  src/routes/api/public/*.
- Lovable AI Gateway for any model call — no user-supplied API keys.

Auth:
- Email/password + Google sign-in, both enabled by default.
- Google provider already connected in this workspace — use the managed
  OAuth credentials, do NOT ask me for client ID/secret.
- Route gate via the integration-managed
  src/routes/_authenticated/route.tsx; redirect signed-out users to
  /auth before any protected loader runs.
- Roles in a separate public.user_roles table + has_role(uuid, app_role)
  security-definer function. Never store roles on profiles.

Data:
- Recreate every table from supabase/migrations/ in order. For each
  CREATE TABLE in public, emit GRANT + ENABLE RLS + CREATE POLICY in
  the same migration.
- Seed reference data from src/lib/seeds.ts. All taxonomies, presets,
  example chips, persona, and learning dictionaries are registered
  there — that's the only place to look.
- Restore my CSV table dumps from <CSV_BUNDLE_URL> after the schema
  applies.

Design system (must be preserved verbatim):
- Tokens live in src/styles.css (@theme inline + custom @utility blocks).
  Do not introduce hard-coded Tailwind colors like text-white / bg-black;
  use semantic tokens (foreground, background, primary, destructive,
  muted-foreground, etc.).
- Fonts: Bowlby One (display/cartoon), Lilita One, Unbounded,
  Luckiest Guy, Cabin Sketch, Inter (body). Load via <link> in
  src/routes/__root.tsx — never @import a URL in src/styles.css.
- Premium typography + layout presets live in
  src/components/ui/typography.tsx (<Display>, <Heading>, <Body>,
  <Kicker>, <Section>, <SectionStack>, <StickerCard>) backed by
  utilities text-display / text-h1..h3 / text-body* / text-kicker /
  section-pad* / sticker-shadow* / btn-sticker / font-cartoon.
- Brand palette: blue / red / silver / black (OG Bot mark). No pastel
  or rainbow-gradient drift.

UX rules to keep:
- Chat surfaces use AI SDK UI + AI Elements primitives; render
  message.parts (not flat text); show "is typing…" while pending.
- Toggle copy is "Turn on / Turn off", never "Enable / Disable" — there
  is a test for this in src/lib/toggle-wording.test.ts; keep it green.
- Icon-only buttons MUST have aria-label.

Out of scope until I ask:
- Don't refactor business logic.
- Don't replace TanStack Start with Next.js / Remix / Vite + React Router.
- Don't replace shadcn/Radix with another UI kit.
- Don't add analytics, A/B, or feature-flag SDKs.

First task: install dependencies, apply migrations, seed reference data
from src/lib/seeds.ts, verify build + typecheck pass, and bring up the
home route. Stop there and show me the preview.
```

That prompt is verbatim-portable: nothing in it depends on this
workspace's IDs, secrets, or Lovable internals.
