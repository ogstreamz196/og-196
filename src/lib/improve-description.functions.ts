import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Takes a rough, free-form description written by the user and returns a
 * short, punchy, lyrics-ready paraphrase suitable to feed into the lyrics
 * generator. Does NOT invent facts and does NOT include the subject's name
 * (the name lives in its own field).
 */
export const improveLyricDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string }) => {
    const text = String(data?.text ?? "").trim().slice(0, 2000);
    if (!text) throw new Error("Description is empty");
    return { text };
  })
  .handler(async ({ data }): Promise<{ improved: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const system = [
      "You rewrite rough songwriter notes into a SHORT, punchy brief for a lyrics AI.",
      "Rules:",
      "- 1–3 sentences, max ~55 words.",
      "- Keep every concrete detail (traits, memories, inside jokes, moods).",
      "- Do NOT invent new facts, names, places or events.",
      "- Do NOT mention or add a person's name — the name is handled separately.",
      "- No headings, no bullet points, no quotes, no emojis, no preamble.",
      "- Output ONLY the rewritten description as plain prose.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.6,
        max_tokens: 220,
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.text },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit — try again in a moment");
      if (res.status === 402) throw new Error("AI credits exhausted");
      throw new Error(`Improve failed (${res.status})`);
    }
    const json = (await res.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
    };
    const improved = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!improved) throw new Error("No improved text returned");
    return { improved };
  });
