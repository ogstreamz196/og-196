// Lyrics generation using the user's own Gemini API key (stored in Supabase secrets).
// Calls Google's Generative Language API directly — no Lovable AI gateway involved.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { adminClient, requireUser } from "../_shared/clients.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

async function getSetting(admin: SupabaseClient, key: string, fallback: number): Promise<number> {
  const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
  const v = (data as { value?: unknown } | null)?.value;
  if (typeof v === "number") return v;
  if (typeof v === "string" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    if (!GEMINI_API_KEY) return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 500);

    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const body = await req.json();
    const songName = (body.songName ?? "").toString().trim().slice(0, 200);
    const description = (body.description ?? "").toString().trim().slice(0, 1000);
    const styleTags = Array.isArray(body.styleTags) ? body.styleTags.slice(0, 10).map(String) : [];
    const language = (body.language ?? "English").toString().trim().slice(0, 50);

    if (!songName && !description) {
      return jsonResponse({ error: "Provide a song name or description" }, 400);
    }

    const songId = body.song_id ? String(body.song_id) : null;

    const admin = adminClient();
    const coinCost = await getSetting(admin, "coins_per_lyrics_generation", 1);

    const reference = songId ?? `lyrics:${crypto.randomUUID()}`;
    const { data: balance, error: deductErr } = await admin.rpc("deduct_coins", {
      p_user: user.id,
      p_amount: coinCost,
      p_reference: reference,
    });
    if (deductErr) {
      return jsonResponse({ error: "Insufficient coins", code: "insufficient_coins" }, 402);
    }

    // Per-request override wins; otherwise fall back to the user's saved preference.
    let foulMouth: boolean;
    if (typeof body.foulMouth === "boolean") {
      foulMouth = body.foulMouth;
    } else {
      const { data: pref } = await admin
        .from("user_preferences")
        .select("foul_mouth")
        .eq("user_id", user.id)
        .maybeSingle();
      foulMouth = (pref as { foul_mouth?: boolean } | null)?.foul_mouth ?? false;
    }

    const isEnglish = language.trim().toLowerCase() === "english";
    const bilingualRule = isEnglish
      ? ""
      : ` Write each line TWICE: first in ${language} using the Latin alphabet (romanised / transliterated — no native script, no Cyrillic, no kanji, no Arabic script, etc.), then on the very next line the English translation in italics-style parentheses, e.g. "Mi corazón late fuerte / (My heart beats strong)". Keep section markers in English.`;

    const systemPrompt = foulMouth
      ? `You are a foul-mouthed, no-holds-barred songwriter writing EXPLICIT adult song lyrics in ${language}. ` +
        `Lean into raw, gritty, street-level language: profanity, swearing, slang and unfiltered attitude are encouraged and expected — make it sound like a parental-advisory track, not a radio edit. ` +
        `Do NOT self-censor, do NOT use asterisks or bleeps, and do NOT add disclaimers. Avoid slurs, sexual content involving minors, and incitement to real-world violence — everything else is fair game. ` +
        `Use clear section markers like [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro].${bilingualRule} ` +
        `Keep the song between 200 and 400 words. Output ONLY the lyrics, no explanations.`
      : `You are a professional songwriter. Write original song lyrics in ${language}. ` +
        `Use clear section markers like [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro].${bilingualRule} ` +
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

    if (!res.ok) {
      // Refund on failure
      await admin.from("coin_transactions").insert({
        user_id: user.id, amount: coinCost, type: "refund", reference,
      });
      const { data: prof } = await admin.from("profiles").select("coin_balance").eq("id", user.id).single();
      await admin.from("profiles").update({ coin_balance: ((prof as { coin_balance?: number } | null)?.coin_balance ?? 0) + coinCost }).eq("id", user.id);

      if (res.status === 429) return jsonResponse({ error: "Gemini rate limit, try again shortly" }, 429);
      const txt = await res.text();
      console.error("Gemini API error", res.status, txt);
      return jsonResponse({ error: "Lyrics generation failed", detail: txt.slice(0, 500) }, 502);
    }

    const data = await res.json();
    const lyrics =
      (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p?.text ?? "")
        .join("")
        .trim() ?? "";

    if (songId) {
      await admin.from("songs").update({ lyrics }).eq("id", songId).eq("user_id", user.id);
    }

    return jsonResponse({ lyrics, coin_balance: balance, coin_cost: coinCost });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
