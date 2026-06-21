import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function deriveSecret(key: string): string {
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const la = Buffer.from(a);
  const lb = Buffer.from(b);
  return la.length === lb.length && timingSafeEqual(la, lb);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tgKey = process.env.TELEGRAM_API_KEY;
        if (!tgKey) return new Response("not_configured", { status: 500 });

        const expected = deriveSecret(tgKey);
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, expected)) return new Response("unauthorized", { status: 401 });

        const update = await request.json().catch(() => null);
        const msg = update?.message ?? update?.edited_message;
        const chat_id: number | undefined = msg?.chat?.id;
        const text: string | undefined = msg?.text;
        if (!chat_id) return Response.json({ ok: true, ignored: true });

        // Capture /start <token> — the token is the user-id hex prefix from
        // the settings page connect link (first 24 chars, no dashes).
        const startMatch = typeof text === "string" ? text.match(/^\/start\s+([a-f0-9]{8,32})/i) : null;
        if (startMatch) {
          const token = startMatch[1].toLowerCase();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: match } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .filter("id::text", "ilike", `${token.slice(0, 8)}%`)
            .limit(50);
          const found = (match ?? []).find(
            (r: { id: string }) => r.id.replace(/-/g, "").slice(0, 24).toLowerCase() === token,
          );
          if (found) {
            await supabaseAdmin
              .from("profiles")
              .update({
                telegram_chat_id: chat_id,
                telegram_username: msg?.from?.username ?? null,
              })
              .eq("id", found.id);

            // Friendly confirmation
            const lovableKey = process.env.LOVABLE_API_KEY;
            if (lovableKey) {
              await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${lovableKey}`,
                  "X-Connection-Api-Key": tgKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  chat_id,
                  text: "✅ Linked! OG Bot can now DM you here.",
                }),
              }).catch(() => undefined);
            }
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});
