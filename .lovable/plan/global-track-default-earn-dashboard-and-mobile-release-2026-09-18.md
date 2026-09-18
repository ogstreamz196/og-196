# Global track default, Earn dashboard, and mobile release

## What will change
- Make every fresh track start as **Global**, while preserving a user's per-track choice during that creation attempt or retry.
- Turn the existing **Earn** screen into a mobile-first dashboard showing referral earnings, published-track totals, and recent player activity without removing referral sharing tools.
- Keep dashboard cards compact, readable, and touch-friendly on phone screens.
- Confirm the Android wrapper targets `https://ogbot.co.uk`, then sync the native project so Android Studio receives the live URL.
- Run focused checks, review security scan status, and request publication to the existing live site.

## Technical details
- Change wizard draft/state fallbacks and song insert fallback from private to global.
- Reuse current user-scoped database access for published songs and activity data; no admin-only data will appear in Earn.
- Add loading, empty, and error-safe states for dashboard figures and recent activity.
- Preserve current routes, referral rules, payments, and track-generation behaviour.
