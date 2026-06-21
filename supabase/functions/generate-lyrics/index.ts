// Lyrics generation using the user's own Gemini API key (stored in Supabase secrets).
// Calls Google's Generative Language API directly — no Lovable AI gateway involved.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getSetting(admin: ReturnType<typeof createClient>, key: string, fallback: number): Promise<number> {
  const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
  const v = (data as { value?: unknown } | null)?.value;
  if (typeof v === "number") return v;
  if (typeof v === "string" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const songName = (body.songName ?? "").toString().trim().slice(0, 200);
    const description = (body.description ?? "").toString().trim().slice(0, 1000);
    const styleTags = Array.isArray(body.styleTags) ? body.styleTags.slice(0, 10).map(String) : [];
    const language = (body.language ?? "English").toString().trim().slice(0, 50);

    if (!songName && !description) {
      return json({ error: "Provide a song name or description" }, 400);
    }

    const systemPrompt =
      `You are a professional songwriter. Write original song lyrics in ${language}. ` +
      `Use clear section markers like [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]. ` +
      `Keep the song between 200 and 400 words. Output ONLY the lyrics, no explanations.`;
    const userPrompt =
      `Song title: ${songName || "(untitled)"}\n` +
      `Theme / description: ${description || "(none)"}\n` +
      `Style tags: ${styleTags.join(", ") || "(none)"}\n` +
      `Language: ${language}\n\nWrite the lyrics now.`;

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 1200 },
      }),
    });

    if (res.status === 429) return json({ error: "Gemini rate limit, try again shortly" }, 429);
    if (!res.ok) {
      const txt = await res.text();
      console.error("Gemini API error", res.status, txt);
      return json({ error: "Lyrics generation failed", detail: txt.slice(0, 500) }, 502);
    }

    const data = await res.json();
    const lyrics =
      (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p?.text ?? "")
        .join("")
        .trim() ?? "";

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
