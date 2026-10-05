import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sports-guide-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const token = request.headers.get("x-ogbot-retry-token") ?? "";
        const { data: ok } = await supabaseAdmin.rpc("verify_song_retry_token", { p_token: token });
        if (!ok) return new Response("Forbidden", { status: 403 });

        const { sendTelegramText } = await import("@/lib/sports-guide.server");
        const { data: due } = await supabaseAdmin
          .from("sports_guide_reminders")
          .select("id, user_id, post:sports_guide_posts(raw_text, event_time, telegram_message_id)")
          .is("sent_at", null)
          .lte("remind_at", new Date().toISOString())
          .limit(100);
        let sent = 0;
        for (const r of due ?? []) {
          // Claim first so overlapping runs never double-send.
          const { data: claimed } = await supabaseAdmin
            .from("sports_guide_reminders")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", r.id)
            .is("sent_at", null)
            .select("id");
          if (!claimed?.length) continue;
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("telegram_chat_id")
            .eq("id", r.user_id)
            .maybeSingle();
          const post = r.post as unknown as { raw_text: string; event_time: string | null } | null;
          if (!prof?.telegram_chat_id || !post) continue;
          const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const snippet = esc(post.raw_text.split("\n").filter(Boolean).slice(0, 4).join("\n").slice(0, 400));
          const okSend = await sendTelegramText(
            prof.telegram_chat_id,
            `🔔 <b>Match alert</b>${post.event_time ? ` · kick-off ${post.event_time}` : ""}\n\n${snippet}\n\n<a href="https://www.ogbot.co.uk/sports">Open Sports Guide</a>`,
          );
          if (okSend) sent++;
        }
        return Response.json({ ok: true, sent });
      },
    },
  },
});
