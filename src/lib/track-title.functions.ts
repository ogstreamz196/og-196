import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Trim quotes/emoji/trailing punctuation the model sometimes wraps titles in. */
export function cleanTitle(raw: string): string {
  return raw
    .split("\n")[0]!
    .replace(/^["'“”‘’\s]+|["'“”‘’\s.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .trim();
}

/** Deterministic fallback so a blank title always becomes something usable. */
export function fallbackTitle(subjectName: string, description: string): string {
  const words = description
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);
  const phrase = words.join(" ");
  const name = subjectName.trim();
  if (phrase && name) return cleanTitle(`${name} — ${phrase}`);
  if (phrase) return cleanTitle(phrase);
  if (name) return cleanTitle(`Song for ${name}`);
  return "Untitled track";
}

/**
 * Writes a punchy song title from the subject's name, the story and the
 * chosen styles. Used when the creator leaves the title field blank.
 */
export const suggestTrackTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subjectName?: string; description?: string; style?: string }) => ({
    subjectName: String(data?.subjectName ?? "")
      .trim()
      .slice(0, 60),
    description: String(data?.description ?? "")
      .trim()
      .slice(0, 1200),
    style: String(data?.style ?? "")
      .trim()
      .slice(0, 200),
  }))
  .handler(async ({ data, context }): Promise<{ title: string }> => {
    const backup = fallbackTitle(data.subjectName, data.description);
    try {
      const { aiChatTarget, fetchAiChat } = await import("@/lib/ai-endpoint.server");
      if (!aiChatTarget(context.userId)) return { title: backup };

      const system = [
        "You name songs. Return ONE title only.",
        "Rules:",
        "- 2 to 5 words, max 40 characters.",
        "- Match the genre and mood; make it feel like a real release.",
        "- Never wrap it in quotes, never add emojis, never explain.",
        "- Do not use the words 'song', 'track' or 'untitled'.",
        "- Output ONLY the title.",
      ].join("\n");

      const { response: res } = await fetchAiChat(
        {
          temperature: 0.9,
          max_tokens: 24,
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: [
                data.subjectName ? `About: ${data.subjectName}` : "",
                data.style ? `Styles: ${data.style}` : "",
                data.description ? `Story: ${data.description}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
        context.userId,
      );
      if (!res.ok) return { title: backup };
      const json = (await res.json().catch(() => ({}))) as {
        choices?: { message?: { content?: string } }[];
      };
      const title = cleanTitle(json.choices?.[0]?.message?.content ?? "");
      return { title: title || backup };
    } catch {
      return { title: backup };
    }
  });
