/**
 * Image editing for OG Bot private chat.
 * Gemini image model first; OpenAI gpt-image-1 fallback only on 429/5xx.
 */
export class ImageEditError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function parseDataUrl(dataUrl: string) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new ImageEditError("Unsupported image format.", 400);
  return { mime: m[1], b64: m[2] };
}

async function editWithGemini(prompt: string, mime: string, b64: string, backup = false) {
  const key = process.env[backup ? "GEMINI_BACKUP_API_KEY" : "GEMINI_API_KEY"];
  if (!key) throw new ImageEditError("Gemini not configured", 503);
  const model = process.env["GEMINI_IMAGE_MODEL"] || "gemini-2.5-flash-image";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("gemini image edit", res.status, t.slice(0, 300));
    throw new ImageEditError(t, res.status);
  }
  const json = (await res.json()) as {
    candidates?: {
      content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
    }[];
  };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new ImageEditError("No image returned (refused).", 422);
  return { mime: part.inlineData.mimeType || "image/png", b64: part.inlineData.data };
}


export async function editImage(prompt: string, dataUrl: string) {
  const { mime, b64 } = parseDataUrl(dataUrl);
  const retryable = (e: unknown) => {
    const s = e instanceof ImageEditError ? e.status : 500;
    return s === 429 || s >= 500;
  };
  try {
    return await editWithGemini(prompt, mime, b64);
  } catch (e) {
    if (!retryable(e)) throw e;
  }
  // Paid backup key: only reached when the primary key is exhausted/down.
  if (process.env["GEMINI_BACKUP_API_KEY"]) {
    try {
      return await editWithGemini(prompt, mime, b64, true);
    } catch (e) {
      if (!retryable(e)) throw e;
    }
  }
  throw new ImageEditError("Image editing is busy right now — try again shortly.", 503);
}
