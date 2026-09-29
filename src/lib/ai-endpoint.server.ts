/**
 * Central AI routing for the app.
 *
 * Ordinary text/vision work is shared between the Boss's Gemini and OpenAI
 * accounts. A provider can take over once after a retryable 429/5xx response.
 * Lovable AI is never used as a fallback.
 */

export type AiChatTarget = {
  url: string;
  headers: Record<string, string>;
  model: string;
  provider: "gemini" | "openai";
};

const GEMINI_OPENAI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

function geminiTarget(): AiChatTarget | null {
  const gemini = process.env.GEMINI_API_KEY;
  if (!gemini) return null;
  return {
    url: GEMINI_OPENAI_URL,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${gemini}` },
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    provider: "gemini",
  };
}

function openAiTarget(): AiChatTarget | null {
  const openai = process.env.OPENAI_API_KEY;
  if (!openai) return null;
  return {
    url: OPENAI_CHAT_URL,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openai}` },
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    provider: "openai",
  };
}

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function aiChatTargets(affinity = "default"): AiChatTarget[] {
  const gemini = geminiTarget();
  const openai = openAiTarget();
  const available = [gemini, openai].filter((target): target is AiChatTarget => target !== null);
  if (available.length < 2) return available;
  return stableBucket(affinity) % 2 === 0 ? available : [available[1], available[0]];
}

/** Backwards-compatible primary target for diagnostics and simple probes. */
export function aiChatTarget(affinity = "default"): AiChatTarget | null {
  return aiChatTargets(affinity)[0] ?? null;
}

export async function fetchAiChat(
  body: Record<string, unknown>,
  affinity = "default",
): Promise<{ response: Response; provider: AiChatTarget["provider"] }> {
  const targets = aiChatTargets(affinity);
  if (!targets.length) throw new Error("AI not configured");

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const response = await fetch(target.url, {
      method: "POST",
      headers: target.headers,
      body: JSON.stringify({ ...body, model: target.model }),
    });
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || index === targets.length - 1) {
      return { response, provider: target.provider };
    }
    await new Promise((resolve) => setTimeout(resolve, 350 + Math.floor(Math.random() * 250)));
  }

  throw new Error("AI not configured");
}

export function needsLiveResearch(text: string): boolean {
  return /(?:^\s*(?:\/research|research:)|\b(?:search the web|look (?:it|this|that) up|latest|today'?s|current news|breaking news|live score|current price|right now)\b)/i.test(
    text,
  );
}

export async function getLiveResearchContext(query: string): Promise<string | null> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  const cleaned = query.replace(/^\s*(?:\/research|research:)\s*/i, "").trim().slice(0, 500);
  if (!cleaned) return null;
  const response = await fetch("https://api.perplexity.ai/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: cleaned, max_results: 5 }),
  });
  if (!response.ok) {
    console.warn("Perplexity search failed", response.status);
    return null;
  }
  const json = (await response.json().catch(() => ({}))) as {
    results?: { title?: string; url?: string; snippet?: string; date?: string }[];
  };
  const results = json.results ?? [];
  if (!results.length) return null;
  return results
    .map(
      (item, index) =>
        `${index + 1}. ${item.title ?? "Source"}${item.date ? ` (${item.date})` : ""}\n${item.snippet ?? ""}\n${item.url ?? ""}`,
    )
    .join("\n\n");
}

/** Transcribe audio bytes with the Boss's own Gemini key. */
export async function transcribeWithGemini(audioBase64: string, mime: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Speech-to-text not configured (GEMINI_API_KEY missing)");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Transcribe this audio clip verbatim. Reply with ONLY the spoken words, no commentary.",
              },
              { inline_data: { mime_type: mime, data: audioBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Gemini STT error", res.status, body.slice(0, 300));
    if (res.status === 429) throw new Error("Rate-limited — try again in a moment.");
    throw new Error(`Transcription failed (HTTP ${res.status})`);
  }
  const json = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p?.text ?? "")
    .join("")
    .trim();
}
