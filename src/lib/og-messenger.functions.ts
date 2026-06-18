import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OgChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Returns the signed-in user's current active OG Bot token, if any.
 *
 * Used by the messenger widget to silently refresh the per-site Bearer token
 * when the previously cached one is rejected (expired / revoked / rotated).
 * Returns `{ token: null, reason }` instead of throwing so the client can
 * fall back to the manual paste flow cleanly.
 */
export const getMyActiveOgBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    token: string | null;
    expires_at: string | null;
    reason: "ok" | "missing" | "revoked" | "expired";
  }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("og_bot_tokens")
      .select("token, expires_at, revoked_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { token: null, expires_at: null, reason: "missing" };
    if (row.revoked_at) return { token: null, expires_at: row.expires_at, reason: "revoked" };
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return { token: null, expires_at: row.expires_at, reason: "expired" };
    }
    return { token: row.token, expires_at: row.expires_at, reason: "ok" };
  });

const SYSTEM_PROMPT =
  "You are OG Bot — a blunt, no-nonsense studio co-pilot for OGStreamz. " +
  "Help users with songwriting, bot tokens, coins, and portal questions. " +
  "Keep replies tight (under 120 words). No corporate fluff, no apologies.";

/**
 * Chat backend for the OG Bot messenger widget.
 *
 * Validates the user's `ogb_` token against the local `og_bot_tokens` table
 * (via the admin client) and then generates a reply through the Lovable AI
 * gateway. The mothership chat endpoint is no longer required.
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
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    // Validate the caller's bot token against our local registry.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: tokenErr } = await supabaseAdmin
      .from("og_bot_tokens")
      .select("user_id, revoked_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (tokenErr) {
      console.error("Token lookup failed", tokenErr);
      throw new Error("Could not verify OG Bot token.");
    }
    if (!row) throw new Error("Invalid OG Bot token.");
    if (row.revoked_at) throw new Error("This OG Bot token has been revoked.");
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("This OG Bot token has expired.");
    }
    if (row.user_id !== context.userId) {
      throw new Error("This token belongs to another account.");
    }

    const systemContent = data.pageContext
      ? `${SYSTEM_PROMPT}\n\nPage context: ${data.pageContext}`
      : SYSTEM_PROMPT;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemContent },
          ...data.messages,
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Lovable AI gateway error", res.status, text);
      if (res.status === 429) throw new Error("OG Bot is rate-limited, try again soon.");
      if (res.status === 402) throw new Error("AI credits exhausted — top up Lovable AI balance.");
      const snippet = text ? ` — ${text.slice(0, 200)}` : "";
      throw new Error(`OG Bot couldn't respond right now (HTTP ${res.status})${snippet}`);
    }

    const json = (await res.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content ?? "";
    return { reply };
  });
