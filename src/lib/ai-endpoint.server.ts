/**
 * Central AI routing for the app.
 *
 * Everything text/vision related goes through the Boss's own Google Gemini
 * key (GEMINI_API_KEY) using Google's OpenAI-compatible endpoint, so the app
 * consumes ZERO Lovable AI credits. The Lovable gateway is only used as a
 * last-resort fallback if no Gemini key is configured.
 */

export type AiChatTarget = {
  url: string;
  headers: Record<string, string>;
  model: string;
  provider: "gemini" | "lovable";
};

const GEMINI_OPENAI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export function aiChatTarget(): AiChatTarget | null {
  const gemini = process.env.GEMINI_API_KEY;
  if (gemini) {
    return {
      url: GEMINI_OPENAI_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gemini}`,
      },
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      provider: "gemini",
    };
  }
  const lovable = process.env.LOVABLE_API_KEY;
  if (lovable) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovable}`,
      },
      model: "google/gemini-3.7-flash",
      provider: "lovable",
    };
  }
  return null;
}

/** Transcribe audio bytes with the Boss's own Gemini key. */
export async function transcribeWithGemini(
  audioBase64: string,
  mime: string,
): Promise<string> {
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
