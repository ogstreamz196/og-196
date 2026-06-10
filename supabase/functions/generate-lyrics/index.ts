// Free lyrics generation using Lovable AI Gateway.
// Returns lyrics in the requested language for the given song topic.

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    const songName = (body.songName ?? "").toString().trim().slice(0, 200);
    const description = (body.description ?? "").toString().trim().slice(0, 1000);
    const styleTags = Array.isArray(body.styleTags) ? body.styleTags.slice(0, 10).map(String) : [];
    const language = (body.language ?? "English").toString().trim().slice(0, 50);

    if (!songName && !description) {
      return json({ error: "Provide a song name or description" }, 400);
    }

    const systemPrompt = `You are a professional songwriter. Write original song lyrics in ${language}. ` +
      `Use clear section markers like [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]. ` +
      `Keep the song between 200 and 400 words. Output ONLY the lyrics, no explanations.`;
    const userPrompt =
      `Song title: ${songName || "(untitled)"}\n` +
      `Theme / description: ${description || "(none)"}\n` +
      `Style tags: ${styleTags.join(", ") || "(none)"}\n` +
      `Language: ${language}\n\nWrite the lyrics now.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) return json({ error: "Rate limit, try again shortly" }, 429);
    if (res.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      return json({ error: "Lyrics generation failed" }, 502);
    }

    const data = await res.json();
    const lyrics = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return json({ lyrics });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
