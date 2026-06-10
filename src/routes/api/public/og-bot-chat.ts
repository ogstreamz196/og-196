import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEFAULT_SCRIPT =
  "You are OG Bot, the in-house messenger and concierge for the Sonix AI music platform. " +
  "Be friendly, hype, and helpful. Keep replies short (1–4 sentences), use line breaks, and answer like a real person.";
const DEFAULT_VOICE =
  "Confident, warm, slightly playful. Hype-man energy without being cringey. Lower-case is fine.";
const DEFAULT_DICTIONARY =
  "OG = original gangster / the boss; Sonix = the platform; coins = generation credits; portal = curated theme; VIP = paid tier.";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/og-bot-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "Missing LOVABLE_API_KEY" }, 500);

        let payload: { token?: string; messages?: Array<{ role: string; content: string }> };
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const token = typeof payload.token === "string" ? payload.token.trim().slice(0, 200) : "";
        if (!token.startsWith("ogb_")) {
          return json({ error: "Invalid OG Bot token" }, 401);
        }

        const messages = Array.isArray(payload.messages)
          ? payload.messages.slice(-20).map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: String(m.content ?? "").slice(0, 4000),
            }))
          : [];
        if (messages.length === 0) return json({ error: "messages required" }, 400);

        const verdict = await verifyOgBotTokenInternal(token);
        if (!verdict.ok) {
          const status =
            verdict.reason === "revoked" || verdict.reason === "expired" ? 403 : 401;
          return json({ error: `Forbidden: token ${verdict.reason}` }, status);
        }

        const { data: rows } = await supabaseAdmin
          .from("site_content")
          .select("key, value")
          .in("key", [
            "og_persona.script",
            "og_persona.voice",
            "og_persona.dictionary",
            "og_persona.foul_mouth",
          ]);
        const map = new Map<string, string>();
        ((rows ?? []) as Array<{ key: string; value: string }>).forEach((r) => map.set(r.key, r.value));

        const script = map.get("og_persona.script")?.trim() || DEFAULT_SCRIPT;
        const voice = map.get("og_persona.voice")?.trim() || DEFAULT_VOICE;
        const dictionary = map.get("og_persona.dictionary")?.trim() || DEFAULT_DICTIONARY;
        const foulMouth = (map.get("og_persona.foul_mouth") ?? "false").toLowerCase() === "true";

        const foulDirective = foulMouth
          ? "\n\n--- LANGUAGE FILTER: OFF ---\nFoul mouth mode is ON. Talk raw, unfiltered, street. Swear naturally when it fits the vibe. Never slurs, never targeted abuse."
          : "\n\n--- LANGUAGE FILTER: ON ---\nKeep it clean. No profanity.";

        const systemPrompt = `${script}\n\n--- VOICE ---\n${voice}\n\n--- DICTIONARY / SLANG ---\n${dictionary}${foulDirective}`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "system", content: systemPrompt }, ...messages],
          }),
        });

        if (res.status === 429) return json({ error: "Rate limited" }, 429);
        if (res.status === 402) return json({ error: "AI credits exhausted" }, 402);
        if (!res.ok) return json({ error: "OG Bot couldn't respond" }, 502);

        const data = await res.json();
        const reply: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
        return json({ reply });
      },
    },
  },
});
