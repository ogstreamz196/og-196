# Minimise account data collection

## Changes
- Stop collecting precise location, IP address, city/country, browser/device details, referrers, landing paths, page visits, menu clicks, and presence heartbeats.
- Remove the location-sharing control so the app never asks for location permission.
- Keep only the account identifier and email needed for sign-in/account linking, plus balances, purchases, preferences, and user-created content needed to provide the service.
- Keep boss sign-in alerts, but make them non-sensitive: signup/sign-in status, time, and an internal shortened account reference only.
- Stop copying user activity/profile details to external spreadsheets; continue storing completed tracks in Drive.
- Clear previously stored sign-in location/device fields and update the Privacy Policy and Trust page to match the reduced collection.

## Verification
- Confirm there are no remaining browser location requests or IP geolocation calls.
- Confirm sign-in notifications still run without personal details.
- Confirm activity tracking is no longer mounted and the app builds successfully.

## Technical details
- Add a database migration that nulls historical sign-in telemetry and profile location/device fields while retaining minimal event timestamps/account linkage.
- Keep the existing two-account device token only for free-credit abuse prevention; it is a random app token, not GPS, advertising ID, contacts, or device hardware data.
