import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OgChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Proxy chat messages to the remote OG Bot backend.
 * The OG_BOT_TOKEN never leaves the server.
 */
export const chatOgBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { messages: OgChatMessage[]; pageContext?: string }) => {
    if (!data || !Array.isArray(data.messages)) throw new Error("messages required");
    const messages = data.messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 4000),
    }));
    const pageContext =
      typeof data.pageContext === "string" ? data.pageContext.slice(0, 500) : "";
    return { messages, pageContext };
  })
  .handler(async ({ data, context }) => {
    const host = process.env.OG_BOT_HOST;
    const token = process.env.OG_BOT_TOKEN;
    if (!host) throw new Error("Missing OG_BOT_HOST");
    if (!token) throw new Error("Missing OG_BOT_TOKEN");

    const res = await fetch(`${host.replace(/\/$/, "")}/api/public/og-bot-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
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
        throw new Error("OG Bot rejected this origin or token. Ask the Boss to whitelist this site.");
      throw new Error("OG Bot couldn't respond right now.");
    }

    const json = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
    if (json.error) throw new Error(json.error);
    return { reply: json.reply ?? "" };
  });
