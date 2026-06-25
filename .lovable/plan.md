## What this builds

A complete sign-in observability + boss-notification system, with a new admin page that merges Supabase data with a live Google Sheets mirror, and a boss-only control panel for notification preferences. All capture is GDPR-compliant (consent + privacy notice for precise GPS; legitimate-interest for IP/UA security telemetry).

## 1. Database (one migration)

- `sign_in_events` — every login: `user_id`, `ip`, `country`, `region`, `city`, `lat`, `lng`, `gps_lat`, `gps_lng`, `ua_raw`, `browser`, `os`, `device_type`, `referrer`, `landing_path`, `is_new_device`, `is_new_country`, `created_at`. RLS: user reads own; admin/boss read all.
- `user_devices` — fingerprint per (user_id, ua_hash, ip_subnet) for "new device" detection. First-seen / last-seen / sign-in count.
- `boss_notification_prefs` — singleton row keyed by boss user_id: `notify_on_signup`, `notify_every_signin`, `notify_new_device`, `notify_new_country`, `notify_suspicious`, `sheets_sync_enabled`, `quiet_hours_start/end`.
- `profiles` extended with denormalized last-seen fields: `last_sign_in_at`, `last_ip`, `last_country`, `last_city`, `last_device`, `sign_in_count`, `gps_consent` (bool), `gps_consent_at`.

All tables get GRANT + RLS scoped to `auth.uid()` / `has_role('admin'|'boss')`. The boss prefs row is created on first admin load.

## 2. Server functions (`src/lib/sign-in-tracking.functions.ts`)

- `recordSignIn({ referrer, landingPath, gpsLat?, gpsLng? })` — `requireSupabaseAuth`. Reads IP from `CF-Connecting-IP` / `X-Forwarded-For`, parses UA, looks up coarse geo via `ipapi.co/{ip}/json` (free, no key, GDPR-safe), upserts `user_devices`, inserts `sign_in_events`, updates `profiles` denormalized fields, then in parallel:
  - Enqueues boss Telegram DM via existing `telegram_dm_queue` if the matching toggle in `boss_notification_prefs` is on and the event qualifies (new signup / every signin / new device / new country).
  - If `sheets_sync_enabled`, calls Google Sheets gateway to upsert the user's row in a `users` tab (one row per user, updated in place).
- `getBossNotifPrefs` / `updateBossNotifPrefs` — admin-only.
- `getUserSignInHistory(userId)` — admin/boss only.
- `triggerSheetsResync` — admin button, rebuilds the whole `users` sheet from `profiles`.

## 3. Boss Telegram notifications

Reuses the existing webhook + `telegram_dm_queue` infrastructure. Messages look like:
```
🆕 New signup: Alex (alex@x.com) · UK · London · Chrome on Mac · ref: google.com
🔐 Sign-in: Alex · 🚨 new device (Safari/iOS) from new country (FR · Paris)
```
The toggle panel decides which of these fire. Quiet hours suppress to a daily digest.

## 4. Client wiring

- `src/components/auth/SignInTracker.tsx` mounted once in `_authenticated/route.tsx`. On `SIGNED_IN` auth event it captures `document.referrer`, current path, optionally requests `navigator.geolocation` (only if `profiles.gps_consent === true`), then calls `recordSignIn`. Idempotent per session via `sessionStorage` key.
- `/auth` page gains a consent line: *"By signing in you agree we log your IP, device, and approximate location for security. Optional: share precise location for richer profile."* with a "Share precise location" opt-in checkbox that flips `profiles.gps_consent`.
- A privacy section is added to `src/routes/welcome.tsx` (or new `/privacy`) listing exactly what is captured, lawful basis (UK GDPR Art 6(1)(f) — legitimate interest), retention (12 months), and how to request deletion.

## 5. Boss control panel — new admin tab

`src/components/admin/BossNotificationPanel.tsx`, surfaced as a new tab on `/admin/index` ("Notifications"). Toggles using the standard `Switch` (with "Turn on/off" labels per project rule). Each toggle saves immediately to `boss_notification_prefs`. Includes a "Send test notification" button and "Resync Sheets now" button.

## 6. /admin/users-pro page

New route `src/routes/_authenticated/admin.users-pro.tsx` (admin/boss only via `has_role` check in server fn). Layout:
- Search/filter bar (name, email, country, device, telegram-linked status, has-gps).
- Virtualized table of users with avatar, last sign-in chip (country flag + city + device), sign-in count, coin balance, Telegram link badge.
- Click row → side-sheet "Profile Card":
  - Identity (name, email, joined, role badges).
  - Activity (last 20 sign-in events: time, IP, geo, device, referrer).
  - Devices (deduped list with first-seen / last-seen).
  - Telegram (chat_id, linked_at, last ping result).
  - Coins (balance + ledger preview, link to full ledger).
  - "View row in Google Sheets" deep-link button (opens the synced spreadsheet at that user's row).

Existing `/admin/users` and `/admin/users/$userId` remain; the new page is the richer one.

## 7. Google Sheets mirror

Uses the existing `google_sheets` connector. On first use, a server fn creates (or reuses) a spreadsheet titled "OG Streamz · Users" in the workspace owner's Drive, with a `users` tab and a fixed header row. Spreadsheet ID stored in `app_settings.users_sheet_id`. Subsequent `recordSignIn` calls do a `values:batchGet` to find the row by user_id (column A), then `values.update` or `values.append`. Failures are non-blocking and logged.

## 8. Legal & safety

- Privacy notice + opt-in for GPS (not on by default).
- No third-party tracker, no fingerprinting beyond UA/IP.
- Boss DMs never include passwords or tokens.
- Sheet is private to the workspace owner's Drive.
- `manage_security_finding` not triggered — no new public endpoints.

## Files touched (summary)

```text
supabase migration: 1 new (4 tables + grants + policies + profile columns)
src/lib/sign-in-tracking.functions.ts        (new)
src/lib/sheets-sync.functions.ts              (new)
src/components/auth/SignInTracker.tsx        (new)
src/components/admin/BossNotificationPanel.tsx (new)
src/routes/_authenticated/admin.users-pro.tsx (new)
src/routes/_authenticated/route.tsx          (mount SignInTracker)
src/routes/_authenticated/admin.index.tsx    (add Notifications tab)
src/routes/auth.tsx                          (consent line + GPS opt-in)
src/components/AppSidebar.tsx                (add "Users Pro" admin link)
src/routes/privacy.tsx                       (new short privacy page)
```

## Open question before I start

GPS opt-in placement — do you want the GPS permission prompt to fire (a) only when the user explicitly toggles "Share precise location" on the auth page, or (b) once after first sign-in via a small in-app modal explaining the benefit (richer profile card, fraud detection)?
