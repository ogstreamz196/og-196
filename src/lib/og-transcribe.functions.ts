import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Transcribe a short audio clip via the Lovable AI Gateway
 * (OpenAI-compatible /v1/audio/transcriptions). Used by the mic
 * button in OG Bot to drop dictation straight into the composer.
 */
export const transcribeOgAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { audioBase64: string; mime?: string }) => {
    if (!data?.audioBase64 || typeof data.audioBase64 !== "string") {
      throw new Error("audioBase64 required");
    }
    // Cap roughly 8MB of base64 (~6MB binary) to stay well under gateway limits.
    if (data.audioBase64.length > 8_000_000) {
      throw new Error("Recording too long — keep clips under ~2 minutes.");
    }
    const mime = (data.mime || "audio/webm").toLowerCase();
    return { audioBase64: data.audioBase64, mime };
  })
  .handler(async ({ data }): Promise<{ text: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    // Derive a filename extension OpenAI accepts from the recorded MIME.
    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/wave": "wav",
      "audio/ogg": "ogg",
      "audio/m4a": "m4a",
    };
    const baseMime = data.mime.split(";")[0].trim();
    const ext = extMap[baseMime] ?? "webm";

    // Decode base64 → bytes → Blob for multipart upload.
    const bin = Buffer.from(data.audioBase64, "base64");
    const blob = new Blob([bin], { type: baseMime });
    if (blob.size < 512) {
      throw new Error("Recording was empty — try again.");
    }

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", blob, `recording.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("STT gateway error", res.status, body);
      if (res.status === 429) throw new Error("Rate-limited — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`Transcription failed (HTTP ${res.status})`);
    }

    const json = (await res.json().catch(() => ({}))) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });
