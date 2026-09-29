# Move app AI entirely to the owner's Gemini account

## Goal
Ensure all AI text, chat, transcription, interview, and lyric-generation requests use the configured `GEMINI_API_KEY`, with no Lovable AI fallback.

## Changes
- Remove Lovable AI routing and fallback code from the shared AI provider helper.
- Make lyric generation require and call Gemini directly, including retries and lyric-repair passes.
- Preserve non-AI Lovable service connections used for payments, Telegram, email, Sheets, and Drive; these are not model inference and removing them would break those features.
- Update diagnostics so Gemini is reported as the app's AI provider and Lovable's key is not presented as an AI requirement.
- Record the provider decision in the project rules.

## Verification
- Confirm the Gemini secret is configured without exposing it.
- Search the full runtime code for remaining Lovable AI Gateway endpoints.
- Run focused tests and formatting checks.
- Deploy the updated existing lyric-generation service and confirm the app build is clean.
- Review AI Gateway logs after the change; future user AI actions should produce no Lovable AI model requests.

## Limitation
Normal hosting, database, storage, and connected-service traffic can still use Lovable Cloud credits. This change removes Lovable **AI model** usage only.
