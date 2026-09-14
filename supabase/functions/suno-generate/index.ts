// Suno generation edge function.
// - Verifies the calling user
// - Reads dynamic pricing from app_settings (coins_per_generation)
// - Deducts coins atomically (refunds on Suno API failure)
// - Calls the Suno API; one task typically produces 2 clips
// - Inserts a 'pending' songs row; suno-callback fills it in + adds extra rows for sibling clips

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { injectSignature, withSignatureHint } from "../_shared/track-signature.ts";
import {
  isModerationRejection,
  MODERATION_MESSAGE,
  softenForModeration,
} from "../_shared/moderation-safe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY")!;
const SUNO_API_URL = "https://apibox.erweima.ai/api/v1/generate";
// Used when the user uploads their own beat — Suno performs vocals over it.
const SUNO_UPLOAD_COVER_URL = "https://apibox.erweima.ai/api/v1/generate/upload-cover";
const ACAPPELLA_STYLE =
  "pure a cappella, vocals only, unaccompanied human voice with layered vocal harmonies and humming, " +
  "every sound made by the human voice and mouth only, absolutely no instruments, no music, no drums, " +
  "no percussion, no bass, no 808, no synths, no piano, no guitar, no strings, no sound effects, " +
  "dry close-mic vocal with light natural room reverb";
const VOCALS_OVER_BEAT_STYLE =
  "vocals only, a cappella lead vocal riding the supplied beat, no added instruments";
const NO_INSTRUMENT_NEGATIVES =
  "instruments, instrumental, music, backing music, backing track, drums, percussion, bass, 808, " +
  "synth, synthesizer, piano, keys, guitar, strings, brass, orchestra, band, beat, producer tag beat, " +
  "sound effects, ambience, dj, scratching, sampler, drum machine";
const MAX_PROMPT_CHARS = 4_800;
const MAX_STYLE_CHARS = 900;
const MAX_TITLE_CHARS = 80;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getSetting(admin: any, key: string, fallback: number): Promise<number> {
  const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
  const v = data?.value;
  return typeof v === "number" ? v : fallback;
}

function limitText(value: string | null, max: number): string | null {
  if (!value) return value;
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const prompt = (body.prompt ?? "").toString().trim();
    // Artist voice picked in the wizard ("Female vocal" | "Male vocal" | "Duo" | "Any voice").
    const vocal = (body.vocal ?? "").toString().trim().slice(0, 40);
    const vocalLower = vocal.toLowerCase();
    const vocalGender = vocalLower.startsWith("female")
      ? "f"
      : vocalLower.startsWith("male")
      ? "m"
      : null;
    const vocalStyle = vocalLower.startsWith("female")
      ? "female vocals, female lead singer"
      : vocalLower.startsWith("male")
      ? "male vocals, male lead singer"
      : vocalLower.startsWith("duo")
      ? "duet, male and female vocals trading lines"
      : null;
    const rawStyle = (body.style ?? "").toString().trim();
    const vocalsOnly = !!body.vocals_only;
    const beatPath = body.beat_path ? String(body.beat_path) : null;
    // Vocals-only: sing over the uploaded beat, or fall back to a pure
    // a cappella with humming and zero instrumentation.
    const acappella = vocalsOnly && !beatPath;
    const vocalsOnlyStyle = vocalsOnly
      ? (beatPath ? VOCALS_OVER_BEAT_STYLE : ACAPPELLA_STYLE)
      : null;
    // Requested track length. Suno exposes no hard duration field, so the
    // target is steered through the style prompt (clamped 3-10 minutes).
    const rawTarget = Number(body.target_duration_sec);
    const targetDurationSec = Math.min(
      600,
      Math.max(180, Number.isFinite(rawTarget) ? Math.round(rawTarget) : 180),
    );
    const targetMinutes = Math.round(targetDurationSec / 60);
    const lengthStyleHint =
      `full length track, approximately ${targetMinutes} minutes (${targetMinutes}:00 or longer), ` +
      `complete arrangement with intro, verses, choruses, bridge and outro, no early fade out, ` +
      `perform every lyric line provided`;
    // Languages the artist picked. Suno has no language field, so the
    // requirement is steered through the style prompt: every picked language
    // must be sung, and section markers in the lyrics say which is which.
    const languageList = Array.from(
      new Set(
        (body.language ?? "").toString().trim().slice(0, 200)
          .split(/\s*(?:\+|,|\/|&|\band\b)\s*/i)
          .map((l: string) => l.trim())
          .filter(Boolean),
      ),
    );
    const languageStyleHint = languageList.length
      ? (languageList.length > 1
        ? `multilingual vocals sung in ${languageList.join(" and ")}, switch language per section exactly as the lyric section markers indicate, keep native pronunciation for each language`
        : `vocals sung in ${languageList[0]} with native pronunciation`)
      : null;
    // Multiple styles: make the section-to-section genre changes explicit.
    const styleCount = rawStyle ? rawStyle.split(/\s*,\s*/).filter(Boolean).length : 0;
    const multiStyleHint = styleCount > 1
      ? `multi-genre arrangement blending ${rawStyle}, each section performed in the genre its lyric section marker names, deliberate transitions between sections`
      : null;
    // For pure a cappella, genre names must only colour the vocal delivery —
    // naming genres outright makes the engine add backing instrumentation.
    const styleParts = acappella
      ? [
        vocalsOnlyStyle,
        rawStyle ? `${rawStyle} vocal delivery, cadence and phrasing performed by voice alone` : null,
        languageStyleHint,
        vocalStyle,
        lengthStyleHint,
      ]
      : [rawStyle, multiStyleHint, languageStyleHint, vocalStyle, vocalsOnlyStyle, lengthStyleHint];
    const style = limitText(
      styleParts.filter(Boolean).join(", ") || null,
      MAX_STYLE_CHARS,
    );
    const lyrics = limitText((body.lyrics ?? "").toString().trim() || null, MAX_PROMPT_CHARS);
    const title = limitText((body.title ?? "").toString().trim() || null, MAX_TITLE_CHARS);
    const instrumental = !!body.instrumental;
    const portalId = body.portal_id ? String(body.portal_id) : null;
    const existingSongId = body.song_id ? String(body.song_id) : null;

    if (!prompt && !lyrics) return json({ error: "Provide a prompt or lyrics" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Capacity gate: global + per-user concurrent caps (peak mode aware).
    {
      const { data: cap, error: capErr } = await admin.rpc("check_generation_capacity", { p_user: user.id });
      if (capErr) return json({ error: capErr.message }, 500);
      if (cap && cap.ok === false) {
        const msg = cap.reason === "global_capacity_full"
          ? `Studio is at capacity (${cap.global_active}/${cap.global_cap} jobs running). Try again in a moment.`
          : `You already have ${cap.user_active} song${cap.user_active === 1 ? "" : "s"} generating (limit ${cap.user_cap}${cap.peak ? ", peak mode" : ""}). Wait for one to finish.`;
        // Capacity is an expected, recoverable app state. Return a successful
        // transport response so the function client does not promote it to an
        // uncaught runtime error; callers inspect `accepted` and keep the UI open.
        return json({ accepted: false, error: msg, code: cap.reason, capacity: cap });
      }
    }

    // Base price covers a 3 minute track; every extra minute costs 1 more coin.
    let coinCost = (await getSetting(admin, "coins_per_generation", 3)) +
      Math.max(0, targetMinutes - 3);

    // If this generation came from a portal, force the hardcoded language into the Suno prompt
    let portalLanguage: string | null = null;
    if (portalId) {
      const { data: p } = await admin
        .from("portals")
        .select("language, status, coin_cost_per_generation")
        .eq("id", portalId)
        .maybeSingle();
      if (!p) return json({ error: "Portal not found" }, 404);
      if (p.status === "maintenance") return json({ error: "Portal is in maintenance mode" }, 423);
      portalLanguage = p.language ?? null;
      if (typeof p.coin_cost_per_generation === "number") coinCost = p.coin_cost_per_generation;
    }
    const effectiveLyrics = lyrics && portalLanguage
      ? `[Language: ${portalLanguage}]\n${lyrics}`
      : lyrics;
    const effectivePrompt = !lyrics && portalLanguage
      ? `[Language: ${portalLanguage}] ${prompt}`
      : prompt;

    const generationStartedAt = new Date().toISOString();

    // Idempotency: if reusing an existing draft, atomically flip its status
    // from a chargeable state (draft/failed) to 'pending' BEFORE deducting.
    // Concurrent duplicate submissions (double-click, client retries, network
    // retries) all target the same row — only one UPDATE affects a row, the
    // rest see zero rows and short-circuit with 409 without charging.
    let existing: { id: string; user_id: string; status: string } | null = null;
    if (existingSongId) {
      const { data: row, error: exErr } = await admin
        .from("songs")
        .select("id, user_id, status")
        .eq("id", existingSongId)
        .maybeSingle();
      if (exErr) return json({ error: exErr.message }, 500);
      if (!row) return json({ error: "Song not found" }, 404);
      if (row.user_id !== user.id) return json({ error: "Song not found" }, 404);
      if (row.status === "pending" || row.status === "processing") {
        return json({ error: "Song is already generating", code: "already_generating", song_id: row.id }, 409);
      }
      // Atomic claim — only one concurrent request wins.
      const { data: claimed, error: claimErr } = await admin
        .from("songs")
        .update({ status: "pending", generation_started_at: generationStartedAt, error_message: null })
        .eq("id", existingSongId)
        .in("status", ["draft", "failed", "completed"])
        .select("id")
        .maybeSingle();
      if (claimErr) return json({ error: claimErr.message }, 500);
      if (!claimed) {
        return json({ error: "Song is already generating", code: "already_generating", song_id: existingSongId }, 409);
      }
      existing = row;
    }

    // Deduct coins FIRST so a rejected charge does not litter the library
    // with an orphan "failed – insufficient coins" song row. Using the song id
    // as the charge reference makes the coin_transactions row idempotent per
    // generation attempt.
    const chargeReference = existing?.id ?? crypto.randomUUID();
    const { data: balance, error: deductErr } = await admin.rpc("deduct_coins", {
      p_user: user.id,
      p_amount: coinCost,
      p_reference: chargeReference,
    });
    let gifted = false;
    if (deductErr) {
      // Gift rule: if the user already paid something towards THIS job (e.g.
      // lyrics were generated and charged for this song) and then ran out of
      // coins midway, we finish the job for free rather than stranding them.
      let alreadyInvested = false;
      if (existing) {
        const { data: priorCharge } = await admin
          .from("coin_transactions")
          .select("id")
          .eq("user_id", user.id)
          .eq("reference", existing.id)
          .limit(1)
          .maybeSingle();
        alreadyInvested = !!priorCharge;
      }
      if (!alreadyInvested) {
        // Roll the row back so a retry can charge cleanly.
        if (existing) {
          await admin.from("songs").update({ status: existing.status }).eq("id", existing.id);
        }
        return json({ error: "Insufficient coins", code: "insufficient_coins" }, 402);
      }
      gifted = true;
      await admin.from("coin_transactions").insert({
        user_id: user.id,
        amount: 0,
        type: "gift",
        reference: `gift:midjob:${chargeReference}`,
      });
      await admin.from("user_notifications").insert({
        user_id: user.id,
        kind: "gift",
        title: "On the house 🎁",
        body: "You ran out of coins midway, so OG Bot finished this track for free.",
        metadata: { song_id: existing?.id ?? null },
      });
    }

    // Create or reuse the song row now that the charge has succeeded.
    let song: { id: string } | null = null;
    if (existing) {
      const { data: upd, error: updErr } = await admin
        .from("songs")
        .update({
          prompt: effectivePrompt,
          style,
          lyrics: effectiveLyrics,
          title,
          status: "pending",
          generation_started_at: generationStartedAt,
          portal_id: portalId,
          audio_path: null,
          sample_path: null,
          stream_audio_url: null,
          error_message: null,
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (updErr) {
        await refund(admin, user.id, existing.id, "Failed to reuse draft", coinCost);
        return json({ error: updErr.message }, 500);
      }
      song = upd;
    } else {
      const { data: inserted, error: songErr } = await admin
        .from("songs")
        .insert({ user_id: user.id, prompt: effectivePrompt, style, lyrics: effectiveLyrics, title, status: "pending", generation_started_at: generationStartedAt, portal_id: portalId })
        .select("id")
        .single();
      if (songErr) {
        // Refund against a synthetic reference since we have no song id yet.
        await admin.rpc("refund_generation_charge", {
          p_user: user.id,
          p_amount: coinCost,
          p_reference: crypto.randomUUID(),
        });
        return json({ error: songErr.message }, 500);
      }
      song = inserted;
    }
    const songId = song!.id;


    const encoder = new TextEncoder();
    const hmacKey = await crypto.subtle.importKey(
      "raw", encoder.encode(SERVICE_ROLE),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(songId));
    const token = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const callbackUrl = `${SUPABASE_URL}/functions/v1/suno-callback?song_id=${songId}&token=${token}`;

    // Sign the uploaded beat so Suno can fetch it (path is namespaced per user).
    let beatUrl: string | null = null;
    if (vocalsOnly && beatPath) {
      if (!beatPath.startsWith(`${user.id}/`)) {
        await refund(admin, user.id, songId, "Beat does not belong to this user", coinCost);
        return json({ error: "Beat not found" }, 404);
      }
      const { data: signed, error: signErr } = await admin.storage
        .from("beats")
        .createSignedUrl(beatPath, 60 * 60);
      if (signErr || !signed?.signedUrl) {
        await refund(admin, user.id, songId, "Could not read the uploaded beat", coinCost);
        return json({ error: "Could not read the uploaded beat" }, 400);
      }
      beatUrl = signed.signedUrl;
    }
    if (vocalsOnly) {
      await admin
        .from("songs")
        .update({ vocals_only: true, beat_path: beatUrl ? beatPath : null })
        .eq("id", songId);
    }

    const customMode = !!(style || effectiveLyrics || title);
    const sunoTitle = limitText(title || "Untitled track", MAX_TITLE_CHARS);

    // Hidden brand signature: sung quietly inside the audio, at most once per
    // minute. Only the payload sent to Suno carries it — the stored/displayed
    // lyrics stay clean. Instrumental tracks have no vocals, so skip them.
    const isInstrumental = vocalsOnly ? false : instrumental;
    // Pure a cappella: rewrite any production section markers (drops,
    // instrumental breaks, beat switches) as voice-only moments so the engine
    // never hears a word that invites instruments.
    const voiceOnlyLyrics = acappella && effectiveLyrics
      ? effectiveLyrics.replace(
          /\[(?:[^\]]*\b(?:drop|instrumental|break|beat|bass|808|solo|interlude|outro beat|intro beat)\b[^\]]*)\]/gi,
          "[Humming vocal interlude — voices only, no instruments]",
        )
      : effectiveLyrics;
    const signedLyrics = isInstrumental
      ? voiceOnlyLyrics
      : limitText(injectSignature(voiceOnlyLyrics, { acappella }), MAX_PROMPT_CHARS);
    const signedPrompt = isInstrumental
      ? effectivePrompt
      : limitText(
          acappella
            ? `${effectivePrompt}\n\nInclude a clearly audible vocal tag, performed by voice alone with no instruments, saying "this track is made by O G Bot, don't forget to visit O G Streamz dot co dot uk" in English, about once every minute.`
            : withSignatureHint(effectivePrompt),
          MAX_PROMPT_CHARS,
        ) ?? effectivePrompt;
    // Submit to Suno. If the engine's moderation blocks the explicit lyrics we
    // soften the strongest words once and resubmit, instead of burning the job.
    const submit = async (lyricsText: string | null, promptText: string | null, styleText: string | null) =>
      await fetch(beatUrl ? SUNO_UPLOAD_COVER_URL : SUNO_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUNO_API_KEY}` },
        body: JSON.stringify({
          prompt: lyricsText || promptText,
          style: styleText || undefined,
          title: customMode ? sunoTitle : undefined,
          customMode,
          instrumental: vocalsOnly ? false : instrumental,
          ...(beatUrl ? { uploadUrl: beatUrl } : {}),
          ...(vocalGender ? { vocalGender } : {}),
          model: "V5",
          negativeTags: acappella
            ? `low quality, muddy mix, distorted, lo-fi, amateur, bad vocals, ${NO_INSTRUMENT_NEGATIVES}`
            : "low quality, muddy mix, distorted, lo-fi, amateur, bad vocals",
          callBackUrl: callbackUrl,
        }),
      });

    let attemptLyrics = signedLyrics;
    let attemptPrompt = signedPrompt;
    let attemptStyle = style;
    let softened = false;
    let taskId: string | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      let sunoRes: Response;
      try {
        sunoRes = await submit(attemptLyrics, attemptPrompt, attemptStyle);
      } catch (_e) {
        await refund(admin, user.id, songId, "Suno API unreachable", coinCost);
        return json({ accepted: false, error: "The music engine is unreachable right now. Try again in a moment." });
      }

      const sunoText = await sunoRes.text();
      let sunoBody: any = {};
      try { sunoBody = JSON.parse(sunoText); } catch { /* keep empty */ }

      const codeNum = typeof sunoBody?.code === "number" ? sunoBody.code : (sunoRes.ok ? 200 : sunoRes.status);
      const reason = sunoBody?.msg || sunoBody?.message || `Suno API ${codeNum}`;
      taskId = sunoBody?.data?.taskId ?? sunoBody?.taskId ?? sunoBody?.task_id ?? null;

      if (sunoRes.ok && codeNum === 200 && taskId) break;

      console.error("Suno rejected task", codeNum, reason);

      if (!softened && isModerationRejection(reason)) {
        softened = true;
        attemptLyrics = softenForModeration(attemptLyrics);
        attemptPrompt = softenForModeration(attemptPrompt);
        attemptStyle = softenForModeration(attemptStyle);
        continue;
      }

      const friendly = isModerationRejection(reason) ? MODERATION_MESSAGE : reason;
      await refund(admin, user.id, songId, friendly, coinCost);
      return json({ accepted: false, error: friendly, code: codeNum });
    }

    if (!taskId) {
      await refund(admin, user.id, songId, "Suno did not return a task ID", coinCost);
      return json({ accepted: false, error: "The music engine didn't accept the job. Your coins were refunded." });
    }

    await admin.from("songs").update({ status: "processing", suno_task_id: taskId }).eq("id", songId);

    return json({ accepted: true, song_id: songId, task_id: taskId, coin_balance: balance, gifted });
  } catch (e) {
    console.error("Unhandled error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function refund(admin: any, userId: string, songId: string, reason: string, amount: number) {
  await admin.from("songs").update({
    status: "failed",
    error_message: reason,
    suno_task_id: null,
  }).eq("id", songId);
  const { error } = await admin.rpc("refund_generation_charge", {
    p_user: userId,
    p_amount: amount,
    p_reference: songId,
  });
  if (error) console.error("Refund failed", error.message);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
