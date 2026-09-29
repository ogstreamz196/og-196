# Share AI workload and increase Battle rewards

## What will change

- Add the owner's ChatGPT API as a second AI provider alongside Gemini.
- Share ordinary chat work between Gemini and ChatGPT, with each able to take over only after a retryable rate-limit or temporary service failure.
- Keep lyrics generation and audio transcription on Gemini because those flows already use Gemini-specific media handling.
- Use the already-saved Perplexity key only when a message clearly needs current web information, then include the retrieved facts in the answer context.
- Never send the same request to both providers at once, avoiding duplicate charges.
- Make Battle Zone wins more frequent through smaller random drops while keeping ordinary chat, repeated lines, and spam unrewarded.

## Battle reward behavior

- Preserve the existing server-only atomic reward function, two-second protection, and one-coin maximum per message.
- Add a low-quality roast band that can award 0.1 coin.
- Keep stronger roasts on progressively larger random bands, with elite rewards unchanged.
- Add tests for the new lower band, random boundaries, repeats, and ordinary messages.

## Technical details

- Extend the central AI target helper with Gemini and OpenAI targets and stable workload selection.
- Fall back only for HTTP 429 and temporary 5xx failures, with one bounded delayed attempt; terminal authentication, billing, content, and request errors will be shown rather than replayed.
- Keep provider keys server-side. Update health checks and project rules to reflect Gemini + ChatGPT workload sharing and Perplexity live-search use.
- Add the new OpenAI key through the secure key form; never place it in chat or source code.
- Run focused AI/Battle tests and verify the automatic app build.

## Outside this change

- Lovable AI remains disabled for end-user AI requests.
- Perplexity will not replace Gemini or ChatGPT for normal conversation.
