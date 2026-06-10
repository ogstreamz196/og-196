import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifyOgBotTokenInternal } from "./og-bot-tokens.functions";

export type OgChatMessage = { role: "user" | "assistant"; content: string };

const DEFAULT_SCRIPT =
  "You are OG Bot, the in-house messenger and concierge for the Sonix AI music platform. " +
  "Be friendly, hype, and helpful. Keep replies short (1–4 sentences), use line breaks, and answer like a real person. " +
  "Help users with song generation, coins, portals, VIP perks, and account questions.";
const DEFAULT_VOICE =
  "Confident, warm, slightly playful. Hype-man energy without being cringey. Lower-case is fine. No emojis spam — at most one per reply.";
const DEFAULT_DICTIONARY =
  "OG = original gangster / the boss; Sonix = the platform; coins = generation credits; portal = curated theme; VIP = paid tier; drop = release a song; cooked = generated; vibe = mood/style.";

export const chatOgBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { messages: OgChatMessage[]; token?: string }) => {
    if (!data || !Array.isArray(data.messages)) throw new Error("messages required");
    const msgs = data.messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 4000),
    }));
    const token = typeof data.token === "string" ? data.token.trim().slice(0, 200) : "";
    return { messages: msgs, token };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    if (!data.token || !data.token.startsWith("ogb_")) {
      throw new Error("OG Bot token required. Paste your token to unlock chat.");
    }
    const verdict = await verifyOgBotTokenInternal(data.token);
    if (!verdict.ok) {
      throw new Error(`Invalid OG Bot token (${verdict.reason}). Ask the Boss for a fresh one.`);
    }



    const { data: rows } = await supabase
      .from("site_content")
      .select("key, value")
      .in("key", [
        "og_persona.script",
        "og_persona.voice",
        "og_persona.dictionary",
        "og_persona.foul_mouth",
      ]);
    const map = new Map<string, string>();
    (rows ?? []).forEach((r: { key: string; value: string }) => map.set(r.key, r.value));

    const script = map.get("og_persona.script")?.trim() || DEFAULT_SCRIPT;
    const voice = map.get("og_persona.voice")?.trim() || DEFAULT_VOICE;
    const dictionary = map.get("og_persona.dictionary")?.trim() || DEFAULT_DICTIONARY;
    const foulMouth = (map.get("og_persona.foul_mouth") ?? "false").toLowerCase() === "true";

    const foulDirective = foulMouth
      ? "\n\n--- LANGUAGE FILTER: OFF ---\nFoul mouth mode is ON. Talk raw, unfiltered, street. Swear naturally when it fits the vibe (shit, fuck, damn, hell). Don't force it — let it feel real, not edgy for the sake of it. Never slurs, never targeted abuse."
      : "\n\n--- LANGUAGE FILTER: ON ---\nKeep it clean. No profanity.";

    const systemPrompt =
      `${script}\n\n--- VOICE ---\n${voice}\n\n--- DICTIONARY / SLANG ---\n${dictionary}${foulDirective}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("OG Bot is rate-limited, try again soon.");
    if (res.status === 402) throw new Error("AI credits exhausted. Top up to keep chatting.");
    if (!res.ok) {
      console.error("OG bot AI error", res.status, await res.text().catch(() => ""));
      throw new Error("OG Bot couldn't respond right now.");
    }
    const json = await res.json();
    const reply: string = json?.choices?.[0]?.message?.content?.trim() ?? "";
    return { reply };
  });
