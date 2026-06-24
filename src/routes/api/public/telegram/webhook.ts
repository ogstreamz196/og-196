import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

// Accepted tokens:
//   - Rotated, single-use: "t_" + 32 lowercase hex chars (matched against
//     profiles.telegram_link_token).
//   - Legacy deterministic: 24 lowercase hex (first 24 chars of profiles.id
//     without dashes).
const TOKEN_RE = /^(t_[a-f0-9]{32}|[a-f0-9]{24})$/;

function deriveSecret(key: string): string {
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const la = Buffer.from(a);
  const lb = Buffer.from(b);
  return la.length === lb.length && timingSafeEqual(la, lb);
}

// Convert a 24-hex token into a UUID prefix with dashes
// ("aaaaaaaabbbbccccddddeeee" → "aaaaaaaa-bbbb-cccc-dddd-eeee") so we can
// do a tight `ilike` lookup against profiles.id (text-cast).
function tokenToUuidPrefix(token: string): string {
  return `${token.slice(0, 8)}-${token.slice(8, 12)}-${token.slice(12, 16)}-${token.slice(16, 20)}-${token.slice(20, 24)}`;
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tgKey = process.env.TELEGRAM_API_KEY;
        if (!tgKey) return new Response("not_configured", { status: 500 });

        const expected =
          process.env.TELEGRAM_WEBHOOK_SECRET ?? deriveSecret(tgKey);
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, expected)) return new Response("unauthorized", { status: 401 });

        const update = await request.json().catch(() => null);
        const msg = update?.message ?? update?.edited_message;
        const chat_id: number | undefined = msg?.chat?.id;
        const text: string | undefined = msg?.text;
        if (!chat_id) return Response.json({ ok: true, ignored: true });

        const startMatch =
          typeof text === "string" ? text.match(/^\/start\s+(\S+)/i) : null;
        if (!startMatch) return Response.json({ ok: true, ignored: true });

        const rawToken = startMatch[1].toLowerCase();
        const tokenMatch = rawToken.match(TOKEN_RE);
        if (!tokenMatch) {
          return Response.json({ ok: true, rejected: "bad_token_format" });
        }
        const token = tokenMatch[1];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let profileId: string | null = null;

        if (token.startsWith("t_")) {
          const { data: byToken } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("telegram_link_token", token)
            .limit(2);
          if (!byToken || byToken.length !== 1) {
            return Response.json({ ok: true, rejected: "no_or_ambiguous_match" });
          }
          profileId = byToken[0].id as string;
        } else {
          const uuidPrefix = tokenToUuidPrefix(token);
          const { data: candidates } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .ilike("id::text", `${uuidPrefix}%`)
            .limit(2);
          if (!candidates || candidates.length !== 1) {
            return Response.json({ ok: true, rejected: "no_or_ambiguous_match" });
          }
          const pid = candidates[0].id as string;
          const reconstructed = pid.replace(/-/g, "").slice(0, 24).toLowerCase();
          if (reconstructed !== token) {
            return Response.json({ ok: true, rejected: "token_mismatch" });
          }
          profileId = pid;
        }

        await supabaseAdmin
          .from("profiles")
          .update({
            telegram_chat_id: chat_id,
            telegram_username: msg?.from?.username ?? null,
            telegram_linked_at: new Date().toISOString(),
            telegram_link_token: null,
          })
          .eq("id", profileId);

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

        return Response.json({ ok: true, linked: true });
      },
    },
  },
});
