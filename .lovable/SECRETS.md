# Transfer-Ready Secrets & Connectors Checklist

Use this checklist after moving this project to a new Lovable workspace. Lovable does **not** carry runtime secrets or connector links across workspaces — you must re-add them. Work top-to-bottom; the app will not boot end-to-end until the **Required** items are set.

Legend: ✅ auto-managed · 🔌 connector (link in Connectors panel) · 🔑 user secret (Project Settings → Secrets) · 💳 Stripe panel · 📨 webhook secret (set by integration)

---

## 1. Auto-managed (do nothing)

| Name | Where it comes from |
|---|---|
| `LOVABLE_API_KEY` ✅ | Auto-provisioned by Lovable on new workspace. If missing, ask agent to run `lovable_api_key--create`. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` ✅ | Auto-written when Lovable Cloud is enabled. |

---

## 2. Connectors — re-link in the **Connectors** panel (sidebar root)

Linking a connector automatically creates the matching secret. Do **not** try to paste these as plain secrets.

| Connector | Secret it creates | Required for |
|---|---|---|
| Google Drive 🔌 | `GOOGLE_DRIVE_API_KEY` | Drive features |
| Google Sheets 🔌 | `GOOGLE_SHEETS_API_KEY` | Sheets features |
| Google Search Console 🔌 | `GOOGLE_SEARCH_CONSOLE_API_KEY` | SEO panel |
| Telegram 🔌 | `TELEGRAM_API_KEY` | OG Telegram bot (gateway calls) |

**Steps:** open Connectors → find provider → **Connect** → sign in with the same Google / Telegram account you used before.

---

## 3. Stripe — re-enable via the Payments panel

Do **not** paste Stripe keys manually. Open **Payments** → enable Stripe → reconnect the same Stripe account. That repopulates:

| Secret | Notes |
|---|---|
| `STRIPE_LIVE_API_KEY` 💳 | Live mode |
| `STRIPE_SANDBOX_API_KEY` 💳 | Sandbox/test mode |
| `PAYMENTS_LIVE_WEBHOOK_SECRET` 📨 | Created when the Stripe live webhook is registered |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET` 📨 | Created when the Stripe sandbox webhook is registered |

---

## 4. User-supplied secrets — paste in **Project Settings → Secrets**

These are values **you** own. Have them ready before transfer.

### AI providers
| Secret | Get it from |
|---|---|
| `GEMINI_API_KEY` 🔑 | https://aistudio.google.com/app/apikey |
| `PERPLEXITY_API_KEY` 🔑 | https://www.perplexity.ai/settings/api |
| `SUNO_API_KEY` 🔑 | Your Suno API dashboard |

### OG Telegram bot (self-hosted pieces)
| Secret | Value source |
|---|---|
| `OG_BOT_TOKEN` 🔑 | BotFather → your bot → API token |
| `OG_BOT_HOST` 🔑 | Public URL of your bot host (e.g. `https://bot.ogstreamz.co.uk`) |
| `OG_BOT_MOTHERSHIP_URL` 🔑 | Public URL of the mothership endpoint |
| `OG_BOT_REMOTE_MINT_SECRET` 🔑 | Long random string — keep the same value across workspaces or all minted links break |
| `TELEGRAM_WEBHOOK_SECRET` 🔑 | Long random string used to validate Telegram webhook calls — must match what's configured on the bot webhook |

> Tip: `OG_BOT_REMOTE_MINT_SECRET` and `TELEGRAM_WEBHOOK_SECRET` are arbitrary random strings. Save the current values somewhere safe (1Password, Bitwarden) **before** transferring so the new workspace uses the same secret and existing links/webhooks keep working. If you don't, you must also re-set the webhook on Telegram's side with the new value.

---

## 5. Post-transfer smoke test

1. Open the app — confirm no `process.env.X is undefined` errors in server function logs.
2. Hit the Telegram **Send test ping** button in the admin panel.
3. Run a Stripe test checkout in sandbox mode.
4. Load the dashboard — Google Sheets / Drive widgets should render without auth prompts.

If any step fails, recheck the corresponding row above.
