// Validates SUNO_API_KEY by querying the provider's credit/balance endpoint.
// Public function (no auth) - returns only whether the key is accepted, never the key.

const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!SUNO_API_KEY) {
    return Response.json({ ok: false, reason: "SUNO_API_KEY not set" }, { status: 500, headers: cors });
  }

  try {
    const r = await fetch("https://apibox.erweima.ai/api/v1/generate/credit", {
      headers: { Authorization: `Bearer ${SUNO_API_KEY}` },
    });
    const text = await r.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }
    return Response.json(
      { ok: r.ok, status: r.status, body: parsed },
      { status: 200, headers: cors },
    );
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500, headers: cors });
  }
});
