import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/suno-ping")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.SUNO_API_KEY ?? "";
        if (!key) return Response.json({ ok: false, reason: "SUNO_API_KEY not set" }, { status: 500 });
        try {
          const r = await fetch("https://apibox.erweima.ai/api/v1/generate/credit", {
            headers: { Authorization: `Bearer ${key}` },
          });
          const text = await r.text();
          let body: unknown = text;
          try { body = JSON.parse(text); } catch { /* keep raw */ }
          return Response.json({ ok: r.ok, status: r.status, body });
        } catch (e) {
          return Response.json({ ok: false, error: String(e) }, { status: 500 });
        }
      },
    },
  },
});
