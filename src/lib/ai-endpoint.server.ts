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
  provider: "gemini" | "openai" | "groq" | "openrouter" | "cerebras" | "mistral" | "pollinations";
  /** Free fallback tiers get text-only messages and no provider-specific params. */
  free?: boolean;
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
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
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

function keyed(
  envKey: string,
  provider: AiChatTarget["provider"],
  url: string,
  model: string,
  extra: Record<string, string> = {},
): AiChatTarget | null {
  const key = process.env[envKey];
  if (!key) return null;
  return {
    url,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...extra },
    model,
    provider,
    free: true,
  };
}

/**
 * Free-tier fallbacks, tried in order only after the premium providers fail.
 * Keyed tiers are skipped when their secret is missing; Pollinations needs no key.
 */
export function freeFallbackTargets(): AiChatTarget[] {
  const list = [
    keyed(
      "GROQ_API_KEY",
      "groq",
      "https://api.groq.com/openai/v1/chat/completions",
      "llama-3.3-70b-versatile",
    ),
    keyed(
      "CEREBRAS_API_KEY",
      "cerebras",
      "https://api.cerebras.ai/v1/chat/completions",
      "llama-3.3-70b",
    ),
    keyed(
      "MISTRAL_API_KEY",
      "mistral",
      "https://api.mistral.ai/v1/chat/completions",
      "mistral-small-latest",
    ),
    keyed(
      "OPENROUTER_API_KEY",
      "openrouter",
      "https://openrouter.ai/api/v1/chat/completions",
      "meta-llama/llama-3.3-70b-instruct:free",
      { "HTTP-Referer": "https://ogbot.co.uk", "X-Title": "OG BOT" },
    ),
    {
      url: "https://text.pollinations.ai/openai",
      headers: { "Content-Type": "application/json" },
      model: "openai",
      provider: "pollinations" as const,
      free: true,
    },
  ];
  return list.filter((t): t is AiChatTarget => t !== null);
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

type Msg = { role: string; content: unknown };

/** Flatten multimodal content to plain text so any free model accepts it. */
function freeBody(body: Record<string, unknown>): Record<string, unknown> {
  const messages = Array.isArray(body.messages) ? (body.messages as Msg[]) : [];
  const flat = messages.map((m) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    if (Array.isArray(m.content)) {
      const text = (m.content as { type?: string; text?: string }[])
        .map((p) =>
          p.type === "text" ? (p.text ?? "") : p.type === "image_url" ? "[image attached]" : "",
        )
        .filter(Boolean)
        .join("\n");
      return { role: m.role, content: text };
    }
    return { role: m.role, content: String(m.content ?? "") };
  });
  const out: Record<string, unknown> = { messages: flat };
  if (body.stream) out.stream = true;
  if (typeof body.temperature === "number") out.temperature = body.temperature;
  return out;
}

function shouldFallThrough(status: number): boolean {
  return status === 429 || status === 402 || status === 401 || status === 403 || status >= 500;
}

export async function fetchAiChat(
  body: Record<string, unknown>,
  affinity = "default",
): Promise<{ response: Response; provider: AiChatTarget["provider"] }> {
  const targets = [...aiChatTargets(affinity), ...freeFallbackTargets()];
  let last: { response: Response; provider: AiChatTarget["provider"] } | null = null;

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    let response: Response;
    try {
      response = await fetch(target.url, {
        method: "POST",
        headers: target.headers,
        body: JSON.stringify({ ...(target.free ? freeBody(body) : body), model: target.model }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (e) {
      console.warn(`AI ${target.provider} network error`, e);
      continue;
    }
    if (!shouldFallThrough(response.status) || index === targets.length - 1) {
      return { response, provider: target.provider };
    }
    console.warn(`AI ${target.provider} returned ${response.status}, falling back`);
    last = { response, provider: target.provider };
    await new Promise((resolve) => setTimeout(resolve, 250 + Math.floor(Math.random() * 200)));
  }

  if (last) return last;
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
  const cleaned = query
    .replace(/^\s*(?:\/research|research:)\s*/i, "")
    .trim()
    .slice(0, 500);
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
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
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
