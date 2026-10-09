/** Copy-paste prompt for the owner's second Lovable project. Built from the live origin so it never goes stale. */
export function buildVaultReceiverPrompt(origin: string) {
  return `Add an OG Vault login receiver to this app, managed from Boss Controls.

My main app (${origin}) creates the API secret and sends a webhook whenever I add, change or remove an OG Vault login. This app must only accept logins that the webhook has marked active.

1. Database: create a table vault_credentials (username text unique, password text, note text, active boolean default true, updated_at timestamptz). RLS on, no public read access; only server code touches it. Also store the last verified ping time.

2. Secret: ask me for a secret named OG_VAULT_WEBHOOK_SECRET using the secure secret form. I'll paste it from my main app (Boss Controls → API & Integrations → OG Vault webhook → Copy). Never hard-code it or show it back in full.

3. Webhook route: create a public server route at /api/public/og-vault that accepts POST JSON:
   { "event": "vault_credential.created" | "vault_credential.updated" | "vault_credential.deleted" | "vault.ping", "timestamp": number, "data": { "id", "username", "password", "note", "active" } }
   Verify every request before doing anything:
   - Header "Authorization: Bearer <secret>" must equal OG_VAULT_WEBHOOK_SECRET, AND
   - Header "X-OG-Signature: sha256=<hex>" must equal HMAC-SHA256 of the exact raw body using OG_VAULT_WEBHOOK_SECRET (constant-time compare).
   - Reject with 401 if either check fails; reject if timestamp is more than 5 minutes old.
   Then: created/updated → upsert by username (case-insensitive); deleted → set active=false for that username; vault.ping → save the verified time and reply {"ok":true,"verified":true}. Always reply 200 {"ok":true} within 5 seconds.

4. Boss Controls → VIP users section: add an "OG Vault API" settings card, visible only to admin/boss roles (check the role on the server). Show:
   - Status badge: Verified (last ping received) / Waiting for test ping / Secret missing.
   - The full receiving address of /api/public/og-vault on the current domain (built from the live site address, never hard-coded) with a Copy button.
   - Whether OG_VAULT_WEBHOOK_SECRET is set (never its value), plus a note to replace it via chat if I make a new secret in the main app.
   - A list of synced logins: username, active on/off, last updated.

5. Login check: where users sign in with their OG Vault ID and PIN, only let them in if a row with that username and password exists and active = true.

6. When done, tell me the receiving address so I can paste it into my main app and press Test ping. Don't hard-code my main app's address or any project IDs anywhere — the shared secret is the only link between the two apps, so moving either app to another workspace or domain won't break it.`;
}
