import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/suno-retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const backendUrl = process.env["SUPABASE_URL"];
        if (!backendUrl || request.headers.get("origin")) {
          return new Response("Forbidden", { status: 403 });
        }
        const { retryDueSongs } = await import("@/lib/suno-auto-retry.server");
        try {
          return Response.json({ ok: true, ...(await retryDueSongs()) });
        } catch (error) {
          console.error("Automatic music recovery failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});