# OG Sports Guide Access

## Goal
Add **OG SPORTS GUIDE ACCESS** to the Store for **10 OG Coins**, then let eligible users claim a private, single-use Telegram group invite.

## Build
- Add a coin price to Store items and seed the new Sports Guide item in the existing catalog.
- Add a secure entitlement record so each purchase is durable, idempotent, and tied to the signed-in account.
- Deduct 10 OG Coins and grant access together in one database operation, preventing duplicate charges.
- Give the Store card clear states: Buy for 10 coins, Connect Telegram, Claim invite, Invite sent, and Already owned.
- Generate a one-person, short-lived Telegram invite on the server and send it to the buyer’s linked Telegram chat.
- Add a boss-only Telegram setup command so the private group can register itself without exposing its chat ID.

## Telegram setup
1. Add OG BOT to the private Telegram group as an administrator.
2. Grant OG BOT permission to invite users.
3. Send `/setsportsgroup` inside that group from the linked Boss Telegram account.
4. OG BOT confirms the group is registered; Store claims then issue private one-use links.

## Technical details
- Database migration adds `coin_price`, a user-owned Sports Guide entitlement table, grants, RLS, and an atomic purchase function.
- Existing cash Store checkout remains unchanged for other products.
- Telegram links use `createChatInviteLink` with `member_limit: 1` and an expiry, and are never generated in the browser.
- The Store and Telegram webhook receive focused tests, followed by authenticated mobile verification and build checks.

## Remaining external step
The group already exists, but OG BOT is not yet its administrator. That Telegram permission must be granted before a real invite can be created.
