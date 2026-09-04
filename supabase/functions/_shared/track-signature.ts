// Hidden promotional signature woven into every generated track.
//
// The signature is sung/spoken inside the audio only. It is never written into
// the lyrics we store or display: it is injected into the payload sent to the
// audio generator at request time.
//
// Rules:
// - Always in English, regardless of the song language (it is a brand name).
// - Clearly audible: a few seconds, blended with the lyrics and the backing.
// - About once per minute of audio (and never twice in a row).

export const SIGNATURE_LINE =
  "(spoken/sung vocal tag, clearly audible and blended with the music, lasting a few seconds: this track was made by O G Bot dot co dot uk)";

/** Instruction appended to prompt-only (non-custom) generations. */
export const SIGNATURE_PROMPT_HINT =
  "Include a clearly audible vocal tag saying \"this track was made by O G Bot dot co dot uk\" in English, lasting a few seconds, blended naturally with the lyrics and instrumental at a level everyone can hear, about once every minute and never in the chorus hook.";

/** Rough lyric lines that fit into one minute of a typical song. */
const LINES_PER_MINUTE = 14;
/** Never exceed this many tags, whatever the lyric length. */
const MAX_TAGS = 4;

/**
 * Insert the hidden signature into a lyric sheet at ~one tag per minute.
 * Returns the original text unchanged when there is nothing to tag.
 */
export function injectSignature(lyrics: string | null | undefined): string | null {
  const text = (lyrics ?? "").trim();
  if (!text) return lyrics ?? null;
  if (text.toLowerCase().includes("o g bot dot co dot uk")) return text;

  const lines = text.split("\n");
  const contentCount = lines.filter((l) => l.trim() && !/^\s*\[.*\]\s*$/.test(l)).length;
  if (contentCount === 0) return text;

  const tags = Math.max(1, Math.min(MAX_TAGS, Math.round(contentCount / LINES_PER_MINUTE)));
  const step = Math.max(LINES_PER_MINUTE, Math.ceil(contentCount / tags));

  const out: string[] = [];
  let seen = 0;
  let placed = 0;
  // Offset the first tag so it never lands on the opening line.
  let nextAt = Math.min(contentCount, Math.max(4, Math.round(step / 2)));

  for (const line of lines) {
    out.push(line);
    const isContent = !!line.trim() && !/^\s*\[.*\]\s*$/.test(line);
    if (isContent) seen += 1;
    if (isContent && placed < tags && seen >= nextAt) {
      out.push(SIGNATURE_LINE);
      placed += 1;
      nextAt = seen + step;
    }
  }
  if (placed === 0) out.push(SIGNATURE_LINE);
  return out.join("\n");
}

/** Append the signature hint to a free-form prompt (no lyric sheet supplied). */
export function withSignatureHint(prompt: string): string {
  if (!prompt.trim()) return prompt;
  if (prompt.toLowerCase().includes("o g bot dot co dot uk")) return prompt;
  return `${prompt}\n\n${SIGNATURE_PROMPT_HINT}`;
}
