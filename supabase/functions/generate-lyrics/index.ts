// Lyrics generation. Primary provider is the Lovable AI Gateway (always-current
// models, no user key); the user's own Gemini key is kept as a fallback.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { adminClient, requireUser } from "../_shared/clients.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
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
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY) return jsonResponse({ error: "No lyrics model configured" }, 500);

    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const body = await req.json();
    const songName = (body.songName ?? "").toString().trim().slice(0, 200);
    const description = (body.description ?? "").toString().trim().slice(0, 1000);
    const styleTags = Array.isArray(body.styleTags) ? body.styleTags.slice(0, 10).map(String) : [];
    const language = (body.language ?? "English").toString().trim().slice(0, 200);
    let personalDetails = (body.personalDetails ?? "").toString().trim().slice(0, 500);
    const extraContext = (body.extraContext ?? "").toString().trim().slice(0, 1000);
    const subjectName = (body.subjectName ?? "").toString().trim().slice(0, 60);

    // ---- Track length target -------------------------------------------------
    // Hard floor of 3 minutes, no upper cap. Clients may pass a longer override
    // via `targetDurationSec`; anything shorter is silently raised to the floor.
    const MIN_TARGET_SEC = 180;
    const requestedSec = Number(body.targetDurationSec);
    const targetSec = Math.max(
      MIN_TARGET_SEC,
      Number.isFinite(requestedSec) ? Math.round(requestedSec) : MIN_TARGET_SEC,
    );
    // ~170 sung words per minute of finished audio, measured against delivered
    // tracks. Bounded on BOTH sides so a 4 minute request does not come back
    // with 7 minutes of lyrics.
    const WORDS_PER_MIN = 170;
    const minWords = Math.round((targetSec / 60) * WORDS_PER_MIN);
    const aimLow = minWords;
    const aimHigh = Math.round(minWords * 1.15);
    const minLines = Math.round(minWords / 7);
    const aimLines = Math.round(minLines * 1.2);
    const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    const targetLabel = `${mmss(Math.max(0, targetSec - 20))}–${mmss(targetSec + 20)}`;


    if (!songName && !description) {
      return jsonResponse({ error: "Provide a song name or description" }, 400);
    }

    // The single Foul Mouth toggle is the only source of tone. If a `mode` is
    // supplied it MUST be the derived value ("og" | "safe") — reject anything
    // else so stale clients or tampered requests can't smuggle in a removed
    // OG-mode value.
    if (body.mode !== undefined && body.mode !== "og" && body.mode !== "safe") {
      return jsonResponse(
        { error: "Invalid mode — must be derived from Foul Mouth ('og' or 'safe')", code: "invalid_mode" },
        400,
      );
    }
    if (
      typeof body.foulMouth === "boolean" &&
      typeof body.mode === "string" &&
      (body.foulMouth ? "og" : "safe") !== body.mode
    ) {
      return jsonResponse(
        { error: "mode does not match foulMouth flag", code: "mode_mismatch" },
        400,
      );
    }

    const songId = body.song_id ? String(body.song_id) : null;

    const admin = adminClient();
    const coinCost = await getSetting(admin, "coins_per_lyrics_generation", 1);

    // Helper to broadcast live progress via the songs row (Realtime).
    const updateProgress = async (progress: number, stage: string) => {
      if (!songId) return;
      try {
        await admin.from("songs").update({
          lyrics_progress: progress,
          lyrics_stage: stage,
        }).eq("id", songId).eq("user_id", user.id);
      } catch (_) { /* progress is best-effort */ }
    };

    if (songId) {
      await admin.from("songs").update({
        lyrics_progress: 5,
        lyrics_stage: "Reading your brief…",
        lyrics_started_at: new Date().toISOString(),
      }).eq("id", songId).eq("user_id", user.id);
    }

    const reference = songId ?? `lyrics:${crypto.randomUUID()}`;
    const { data: balance, error: deductErr } = await admin.rpc("deduct_coins", {
      p_user: user.id,
      p_amount: coinCost,
      p_reference: reference,
    });
    if (deductErr) {
      await updateProgress(0, "");
      return jsonResponse({ error: "Insufficient coins", code: "insufficient_coins" }, 402);
    }
    await updateProgress(20, "Finding the vibe…");


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

    // Default personal context: weave the user's display_name + artist_bio from
    // their profile so lyrics feel personal without the user having to retype
    // it every time. Per-request `personalDetails` always wins.
    if (!personalDetails) {
      const { data: prof } = await admin
        .from("profiles")
        .select("display_name, artist_bio")
        .eq("id", user.id)
        .maybeSingle();
      const p = (prof ?? null) as { display_name?: string | null; artist_bio?: string | null } | null;
      const parts: string[] = [];
      if (p?.display_name?.trim()) parts.push(`Artist name: ${p.display_name.trim()}`);
      if (p?.artist_bio?.trim()) parts.push(`Bio: ${p.artist_bio.trim().slice(0, 400)}`);
      personalDetails = parts.join(" · ");
    }


    // Languages arrive as a single field that may hold several picks
    // ("English + Turkish + Romanian" or a comma separated list).
    const languageList = Array.from(
      new Set(
        language
          .split(/\s*(?:\+|,|\/|&|\band\b)\s*/i)
          .map((l) => l.trim())
          .filter(Boolean),
      ),
    );
    const languagesLabel = languageList.join(", ") || "English";
    const nonEnglish = languageList.filter((l) => l.toLowerCase() !== "english");
    const isEnglish = nonEnglish.length === 0;
    const multiLanguage = languageList.length > 1;

    const bilingualRule = isEnglish
      ? ""
      : ` Write each non-English line in the section's language using the Latin alphabet (romanised / transliterated — no native script, no Cyrillic, no kanji, no Arabic script, etc.). Keep section markers in English.`;

    const multiLanguageRule = multiLanguage
      ? ` MULTILINGUAL REQUIREMENT (critical): the artist picked ${languageList.length} languages — ${languagesLabel}. EVERY one of them must actually be sung in the finished song, not just mentioned. Assign languages to whole sections and rotate through them in order so each language owns at least one full section (for example [Verse 1] in ${languageList[0]}, [Verse 2] in ${languageList[1]}${languageList[2] ? `, [Bridge] in ${languageList[2]}` : ""}), and mark each section's language on the marker line like "[Verse 2 – ${languageList[1]}]". The [Chorus] stays in ${languageList[0]} every time so the hook is recognisable, but add one repeated hook line in ${languageList[1]} inside each chorus. If there are more languages than sections, share sections by giving each language its own consecutive block of lines inside that section, still labelled.`
      : "";


    // English rides along as a REMIX feature ONLY when the artist actually
    // picked English alongside other languages. If English was not selected,
    // no English is sung anywhere in the track.
    const englishSelected = languageList.some((l) => l.toLowerCase() === "english");
    const englishRemixRule = (!isEnglish && englishSelected)
      ? ` ENGLISH REMIX REQUIREMENT (critical): English was picked alongside ${nonEnglish.join(" and ")}, so it is part of the remix. The [Intro] MUST be fully in English (a short hype intro naming the song/artist vibe). After that, the picked language(s) LEAD the song — most lines, and the main hook, stay in ${nonEnglish.join(" and ")} — but sprinkle English throughout like a remix feature: at least 2 English lines or ad-libs inside every verse and every chorus, an English line at the end of each hook repeat, and a mostly-English [Outro]. Roughly a quarter of all sung lines should be English, spread across the whole track, not clumped in one section. Never let English take over a full verse or the main chorus melody — it is the feature, not the lead.`
      : (!isEnglish
        ? ` NO-ENGLISH RULE (critical): English was NOT selected. Do not sing or speak any English anywhere in the song — no English intro, no English ad-libs, no English outro. Every sung line stays in the selected language(s) only. (Section markers stay in English brackets as usual, and any parenthetical translation lines are for reference only.)`
        : "");

    // One non-English pick: the whole song leads in it.
    const singleLanguageRule = (!multiLanguage && !isEnglish)
      ? ` SINGLE-LANGUAGE REQUIREMENT (critical): the artist picked ${languageList[0]}. Every sung line — every verse, every chorus, pre-chorus, bridge, intro, outro and ad-lib — must be written in ${languageList[0]}. Do NOT flip the balance: ${languageList[0]} is the lead language everywhere. The hook melody lines stay in ${languageList[0]}.`
      : "";

    // Pick a full-song structure driven by the chosen style tags so the
    // output reads as a complete, performable track — not a few stray verses.
    const tagsLower = styleTags.map((t) => t.toLowerCase()).join(" ");
    const isRap = /(rap|hip[- ]?hop|drill|trap|grime|afro\s*drill)/.test(tagsLower);
    const isBallad = /(ballad|acoustic|piano|folk|country|singer[- ]songwriter)/.test(tagsLower);
    const isDance = /(dance|edm|house|techno|club|electro|pop)/.test(tagsLower);
    const isRock = /(rock|metal|punk|indie|alt)/.test(tagsLower);
    const vocalsOnly = body.vocalsOnly === true;

    const structure = vocalsOnly
      ? "[Intro – hummed melody, voices only] (4 lines) → [Verse 1] (8 lines) → [Chorus] (6 lines, layered vocal harmonies) → [Verse 2] (8 lines) → [Chorus] (6 lines) → [Humming Interlude – voices only] (4 lines) → [Bridge] (6 lines, whispered then sung) → [Chorus] (x2, 12 lines) → [Outro – soft humming fades] (4 lines)"
      : isRap
      ? "[Intro] (4 lines) → [Verse 1] (16 bars) → [Hook] (8 bars, catchy repeatable) → [Verse 2] (16 bars) → [Hook] → [Bridge] (8 bars) → [Verse 3] (12 bars) → [Hook] (x2) → [Outro] (4 lines, ad-libs ok)"
      : isBallad
      ? "[Intro] (4 lines, scene-setting) → [Verse 1] (8 lines) → [Chorus] (6 lines, memorable hook) → [Verse 2] (8 lines) → [Chorus] (6 lines) → [Bridge] (6 lines, emotional turn) → [Final Chorus] (8 lines, lifted, optional key change cue in parentheses) → [Outro] (4 lines)"
      : isDance
      ? "[Intro] (4 lines, vibe-setter) → [Verse 1] (8 lines) → [Pre-Chorus] (4 lines, build-up) → [Chorus] (6 lines, anthemic hook) → [Verse 2] (8 lines) → [Pre-Chorus] (4 lines) → [Chorus] (6 lines) → [Drop] (4 lines) → [Bridge] (6 lines) → [Chorus] (x2, 12 lines) → [Outro] (4 lines)"
      : isRock
      ? "[Intro] (4 lines) → [Verse 1] (8 lines) → [Chorus] (6 lines) → [Verse 2] (8 lines) → [Chorus] (6 lines) → [Bridge / Guitar Solo cue] (6 lines) → [Verse 3] (6 lines) → [Chorus] (x2, 12 lines) → [Outro] (4 lines)"
      : "[Intro] (4 lines) → [Verse 1] (8 lines) → [Pre-Chorus] (4 lines) → [Chorus] (6 lines, hook) → [Verse 2] (8 lines) → [Pre-Chorus] (4 lines) → [Chorus] (6 lines) → [Bridge] (6 lines) → [Verse 3] (6 lines) → [Chorus] (final, lifted, 8 lines) → [Outro] (4 lines)";

    const multiStyleRule = styleTags.length > 1
      ? ` MULTI-STYLE REQUIREMENT (critical): the artist picked ${styleTags.length} styles — ${styleTags.join(", ")}. Every one must be audible in the finished track, so give each style its own section and note it on the marker line, e.g. "[Verse 2 – ${styleTags[1]}]". Match each section's cadence, line length, rhyme density and vocabulary to that style (rap sections in bars with tight internal rhyme, ballad sections in longer sung lines, dance sections in short chantable lines), and let the transitions feel deliberate rather than random. The hook blends the two lead styles (${styleTags.slice(0, 2).join(" + ")}).`
      : "";

    const structureRule =
      ` Deliver a COMPLETE, performable song that runs ${targetLabel} when sung — NOT longer. That means ${aimLow}–${aimHigh} words and ${minLines}–${aimLines} lyric lines (excluding section markers). Going over ${aimHigh} words is a failure: trim sections rather than exceed it. Follow this structure for the chosen style: ${structure}.` +
      ` Use the bracketed section markers verbatim (e.g. [Verse 1], [Chorus], [Bridge], [Outro]), each on its own line, with a blank line between sections. Every section must have lyrics — no placeholders, no "(instrumental)" unless the structure explicitly says so.` +
      ` The [Chorus] must be written out IN FULL every time it appears (never write "repeat chorus" or "x2" as a shortcut) — it is the same repeatable hook tied to the song title or central theme.` +
      ` Do NOT cut the song short either — hit every section in the structure and stay inside the word range given.` +
      multiStyleRule + multiLanguageRule + singleLanguageRule + englishRemixRule;


    const systemPrompt = foulMouth
      ? `You are a foul-mouthed, no-holds-barred songwriter writing EXPLICIT adult song lyrics in ${languagesLabel}. ` +
        (isEnglish
          ? `Lean ALL the way into raw, gritty, street-level English: drop "fuck", "fucking", "shit", "dickhead", "bastard", "bitch", "asshole" and similar profanity liberally throughout EVERY verse and chorus — at least a few per section. `
          : `Lean ALL the way into raw, gritty, street-level ${languagesLabel}: use authentic native profanity, curse words, and savage slang from each of those languages itself (do NOT just translate English swears literally — use the equivalents real native speakers would actually shout). Drop them liberally throughout EVERY verse and chorus — at least a few per section. `) +
        `Use unfiltered attitude, savage punchlines, and trash-talk energy from the very first line. Make it sound like a parental-advisory hip-hop / punk track, NOT a radio edit. ` +
        `Do NOT self-censor, do NOT use asterisks or bleeps, and do NOT add disclaimers. Avoid slurs, sexual content involving minors, and direct incitement to real-world violence — everything else is fair game.` +
        structureRule + bilingualRule +
        ` Target ${aimLow}–${aimHigh} words (never fewer than ${minWords}, never more than ${aimHigh}). Output ONLY the lyrics, no explanations.`
      : `You are a professional songwriter writing CLEAN, radio-friendly song lyrics in ${languagesLabel}. ` +
        `STRICT RULE: absolutely NO profanity, swear words, slurs, or vulgar terms in any language — no English swears, no swears in ${languagesLabel} either. No sexual content, no graphic violence, no drug references. If you need attitude, channel it through clever wordplay and metaphor — never through swearing. The result must be safe for radio, family streaming, and a children's playlist.` +
        structureRule + bilingualRule +
        ` Target ${aimLow}–${aimHigh} words (never fewer than ${minWords}, never more than ${aimHigh}). Output ONLY the lyrics, no explanations.`;

    const subjectRule = subjectName
      ? `\nSUBJECT NAME (CRITICAL, top priority): This entire song is dedicated to "${subjectName}". Repeat the name "${subjectName}" as many times as musically possible — target AT LEAST 20 mentions across the full song, ideally 25–35. Land "${subjectName}" in EVERY line of the hook/chorus (so each chorus repetition drops the name 2–4 times), at least twice in every verse, in the pre-chorus, in the bridge, and in the outro as an ad-lib/chant. Rhyme other lines around the name so it feels inevitable. Never chant it back-to-back on the same line more than twice; keep it musical, affectionate, and embedded — but do NOT be shy: the listener must be in no doubt this song is about "${subjectName}".\n`
      : "";

    const userPrompt =
      `Song title: ${songName || "(untitled)"}\n` +
      (subjectName ? `Dedicated to: ${subjectName}\n` : "") +
      `Theme / description (FOLLOW THIS PRECISELY — every verse, the hook, and the bridge must draw specific imagery, moments, feelings, and vocabulary directly from this brief; do not drift into generic filler): ${description || "(none)"}\n` +
      `Style tags: ${styleTags.join(", ") || "(none)"}\n` +
      `Language(s) — every one of these must actually be sung somewhere in the song: ${languagesLabel}\n` +
      (personalDetails
        ? `Artist profile (weave these into the lyrics naturally — reference the artist's name and a couple of personal details across the song so it feels personal, but DO NOT force them into every line, and never let them overpower the theme. Aim for the name/details to appear roughly 2–4 times total, ideally in the hook/chorus or a memorable line, spread across different sections — not back-to-back): ${personalDetails}\n`
        : "") +
      subjectRule +
      (extraContext ? `Extra context from the artist (use these details literally in the lyrics): ${extraContext}\n` : "") +
      `\nWrite the FULL song now — about ${mmss(targetSec)} of singable material (${aimLow}–${aimHigh} words, ${minLines}–${aimLines} lyric lines, do not exceed that). Do not stop early, do not abbreviate repeated choruses, hit EVERY section in the structure, stay ruthlessly on-theme with the description above, and drop "${subjectName || "the subject"}" as often as the music allows.`;

    const modelUrl = (model: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${GEMINI_API_KEY}`;

    await updateProgress(40, "Writing verses…");

    // Turn (role, parts) history into OpenAI-style chat messages for the gateway.
    type Turn = { role: string; parts: Array<{ text: string }> };
    const toChatMessages = (contents: unknown[]) => [
      { role: "system", content: systemPrompt },
      ...(contents as Turn[]).map((c) => ({
        role: c.role === "model" ? "assistant" : "user",
        content: (c.parts ?? []).map((p) => p?.text ?? "").join(""),
      })),
    ];

    type Gen = { ok: boolean; status: number; text: string; detail?: string };

    // Primary: Lovable AI Gateway (no user key, current models).
    const callGateway = async (contents: unknown[]): Promise<Gen | null> => {
      if (!LOVABLE_API_KEY) return null;
      for (const model of ["google/gemini-3.7-flash", "google/gemini-3.6-flash"]) {
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": LOVABLE_API_KEY,
            },
            body: JSON.stringify({
              model,
              messages: toChatMessages(contents),
              temperature: 0.9,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const text = (data?.choices?.[0]?.message?.content ?? "").toString().trim();
            if (text) return { ok: true, status: 200, text };
            continue;
          }
          const detail = await res.text();
          console.error("Lovable AI error", model, res.status, detail.slice(0, 300));
          // 402/403 are terminal for the workspace — surface them.
          if (res.status === 402 || res.status === 403) {
            return { ok: false, status: res.status, text: "", detail };
          }
        } catch (e) {
          console.error("Lovable AI request failed", model, e);
        }
      }
      return null;
    };

    const postTo = (model: string, contents: unknown[]) =>
      fetch(modelUrl(model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.9, maxOutputTokens: 8192 },
        }),
      });

    const extractText = (data: unknown) =>
      ((data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null)
        ?.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p?.text ?? "")
        .join("")
        .trim();

    // Fallback: the user's own Gemini key, retried across live model ids.
    const FALLBACK_MODELS = [GEMINI_MODEL, GEMINI_MODEL, "gemini-2.0-flash"];
    const callGemini = async (contents: unknown[]): Promise<Gen> => {
      if (!GEMINI_API_KEY) {
        return { ok: false, status: 503, text: "", detail: "No lyrics model available" };
      }
      let last: Gen = { ok: false, status: 503, text: "", detail: "No response" };
      for (let i = 0; i < FALLBACK_MODELS.length; i++) {
        const res = await postTo(FALLBACK_MODELS[i], contents);
        if (res.ok) return { ok: true, status: 200, text: extractText(await res.json()) };
        const detail = await res.text();
        last = { ok: false, status: res.status, text: "", detail };
        if (res.status !== 429 && res.status < 500) return last;
        console.error("Gemini transient error", FALLBACK_MODELS[i], res.status);
        await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
      }
      return last;
    };

    const generate = async (contents: unknown[]): Promise<Gen> => {
      const viaGateway = await callGateway(contents);
      if (viaGateway?.ok) return viaGateway;
      const viaGemini = await callGemini(contents);
      if (viaGemini.ok) return viaGemini;
      return viaGateway ?? viaGemini;
    };

    const res = await generate([{ role: "user", parts: [{ text: userPrompt }] }]);


    if (!res.ok) {
      // Refund on failure
      await admin.from("coin_transactions").insert({
        user_id: user.id, amount: coinCost, type: "refund", reference,
      });
      const { data: prof } = await admin.from("profiles").select("coin_balance").eq("id", user.id).single();
      await admin.from("profiles").update({ coin_balance: ((prof as { coin_balance?: number } | null)?.coin_balance ?? 0) + coinCost }).eq("id", user.id);
      await updateProgress(0, "");

      if (res.status === 429) return jsonResponse({ error: "AI is busy right now — try again shortly" }, 429);
      if (res.status === 402) return jsonResponse({ error: "AI credits exhausted — top up to keep creating" }, 402);
      const txt = res.detail ?? "";
      console.error("Lyrics model error", res.status, txt);
      return jsonResponse({ error: "Lyrics generation failed", detail: txt.slice(0, 500) }, 502);
    }

    await updateProgress(80, "Polishing bars…");

    let lyrics = res.text;


    // Length guard: enforce the minimum target. If the model came back short,
    // ask it to extend the SAME song (never a new one), up to twice.
    const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;
    for (let attempt = 0; attempt < 2 && lyrics && wordCount(lyrics) < minWords; attempt++) {
      await updateProgress(88, "Extending to full length…");
      try {
        const topUp = await generate([
          { role: "user", parts: [{ text: userPrompt }] },
          { role: "model", parts: [{ text: lyrics }] },
          {
            role: "user",
            parts: [{
              text:
                `This draft is too short for a ${mmss(targetSec)} song. Rewrite the SAME song, keeping the existing title, theme, hook wording and section markers, but expand it to at least ${aimLow} words and ${minLines}+ lyric lines: add the missing sections from the structure, write every chorus out in full, and lengthen thin verses with new on-theme lines (no filler, no repetition beyond the hook). Output ONLY the complete lyrics.`,
            }],
          },
        ]);
        if (topUp.ok) {
          const extended = topUp.text;
          if (wordCount(extended) > wordCount(lyrics)) lyrics = extended;
          else break;
        } else break;

      } catch (e) {
        console.error("lyrics top-up failed", e);
        break;
      }
    }

    const words = wordCount(lyrics);
    const estimatedSec = Math.max(targetSec, Math.round((words / WORDS_PER_MIN) * 60));

    if (songId) {
      await admin.from("songs").update({
        lyrics,
        lyrics_progress: 100,
        lyrics_stage: "Ready",
      }).eq("id", songId).eq("user_id", user.id);
    }


    return jsonResponse({
      lyrics,
      coin_balance: balance,
      coin_cost: coinCost,
      word_count: words,
      target_duration_sec: targetSec,
      estimated_duration_sec: estimatedSec,
      estimated_duration_label: `${mmss(estimatedSec)}–${mmss(estimatedSec + 30)}`,
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
