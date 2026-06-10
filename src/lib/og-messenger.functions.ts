import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OgChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Proxy chat messages to the remote OG Bot backend using the
 * end-user's own OG Bot token. Each user supplies their own token.
 */
export const chatOgBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { messages: OgChatMessage[]; token: string; pageContext?: string }) => {
    if (!data || !Array.isArray(data.messages)) throw new Error("messages required");
    const token = typeof data.token === "string" ? data.token.trim().slice(0, 200) : "";
    if (!token.startsWith("ogb_")) {
      throw new Error("OG Bot token required. Paste your token to unlock chat.");
    }
    const messages = data.messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 4000),
    }));
    const pageContext =
      typeof data.pageContext === "string" ? data.pageContext.slice(0, 500) : "";
    return { messages, token, pageContext };
  })
  .handler(async ({ data, context }) => {
    const host = process.env.OG_BOT_HOST;
    if (!host) throw new Error("Missing OG_BOT_HOST");

    const res = await fetch(`${host.replace(/\/$/, "")}/api/public/og-bot-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: data.token,
        visitor_id: context.userId,
        messages: data.messages,
        page_context: data.pageContext,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("OG Bot backend error", res.status, text);
      if (res.status === 429) throw new Error("OG Bot is rate-limited, try again soon.");
      if (res.status === 402) throw new Error("AI credits exhausted on the OG Bot backend.");
      if (res.status === 401 || res.status === 403)
        throw new Error("Invalid or unauthorized OG Bot token.");
      throw new Error("OG Bot couldn't respond right now.");
    }

    const json = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
    if (json.error) throw new Error(json.error);
    return { reply: json.reply ?? "" };
  });
