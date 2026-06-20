import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSystemPrompt, type UserContextSummary } from "@/lib/og-persona";

export type OgChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Legacy: returns the signed-in user's active OG Bot token if any.
 * The unified messenger no longer requires this token — chat is auth-only.
 * Kept so existing settings/admin UI that reads it still compiles.
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

interface ChatReply {
  reply: string;
  coin_balance: number;
}

/**
 * Unified chat backend for the OG Messenger page and the floating widget.
 *
 * - Authenticates via Supabase (no extra token required).
 * - Charges 1 OG coin per message (atomic via `deduct_coins` RPC).
 * - Pulls the user's foul-mouth preference, role flags, profile, and any
 *   Boss persona overrides from `site_content`, then builds the system
 *   prompt accordingly.
 * - Returns the assistant reply plus the user's new coin balance.
 */
export const chatOgBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { messages: OgChatMessage[]; pageContext?: string; mode?: "safe" | "og" }) => {
    if (!data || !Array.isArray(data.messages)) throw new Error("messages required");
    const messages = data.messages.slice(-30).map((m) => ({
      role: m.role === "assistant" ? "assistant" as const : "user" as const,
      content: String(m.content ?? "").slice(0, 4000),
    }));
    if (messages.length === 0) throw new Error("Empty conversation");
    const pageContext =
      typeof data.pageContext === "string" ? data.pageContext.slice(0, 200) : "";
    const mode: "safe" | "og" = data.mode === "safe" ? "safe" : "og";
    return { messages, pageContext, mode };
  })
  .handler(async ({ data, context }): Promise<ChatReply> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Load user context in parallel (profile, role flags, foul pref, persona overrides).
    const [profileRes, rolesRes, prefRes, siteRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("display_name, email, coin_balance")
        .eq("id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId),
      supabaseAdmin
        .from("user_preferences")
        .select("foul_mouth")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("site_content")
        .select("key, value")
        .in("key", ["og_persona.script", "og_persona.voice", "og_persona.dictionary"]),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    const profile = profileRes.data;
    if (!profile) throw new Error("Profile not found");
    if ((profile.coin_balance ?? 0) <= 0) {
      throw new Error(
        "Out of OG coins. Top up from Buy OG Coins or grab VIP to keep chatting.",
      );
    }

    const roles = (rolesRes.data ?? []).map((r) => r.role);
    const personaMap = new Map<string, string>(
      (siteRes.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
    );
    const foulMouth = prefRes.data?.foul_mouth ?? true;

    const userCtx: UserContextSummary = {
      display_name: profile.display_name,
      email: profile.email,
      coin_balance: profile.coin_balance ?? 0,
      is_admin: roles.includes("admin"),
      is_vip: roles.includes("vip"),
      page_context: data.pageContext || undefined,
    };

    const system = buildSystemPrompt({
      mode: data.mode,
      foulMouth,
      bossScript: personaMap.get("og_persona.script") ?? null,
      bossVoice: personaMap.get("og_persona.voice") ?? null,
      bossDictionary: personaMap.get("og_persona.dictionary") ?? null,
      user: userCtx,
    });

    // 2. Deduct 1 coin atomically BEFORE the AI call to avoid double-spend on retry.
    const { data: newBalance, error: deductErr } = await supabaseAdmin.rpc("deduct_coins", {
      p_user: context.userId,
      p_amount: 1,
      p_reference: "og_messenger_chat",
    });
    if (deductErr) {
      if (/insufficient_coins/i.test(deductErr.message)) {
        throw new Error("Out of OG coins. Top up to keep chatting.");
      }
      throw new Error(deductErr.message);
    }

    // 3. Optional Firecrawl research prelude. If the latest user message
    //    starts with "/research " or "research:" AND FIRECRAWL_API_KEY is
    //    set, scrape the web and prepend findings as a RESEARCH block.
    const outgoing = [...data.messages];
    const last = outgoing[outgoing.length - 1];
    if (last?.role === "user") {
      const m = last.content.match(/^\s*(?:\/research|research:)\s+(.+)$/i);
      const fcKey = process.env.FIRECRAWL_API_KEY;
      if (m && fcKey) {
        const query = m[1].trim().slice(0, 200);
        try {
          const r = await fetch("https://api.firecrawl.dev/v2/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${fcKey}`,
            },
            body: JSON.stringify({ query, limit: 5 }),
            signal: AbortSignal.timeout(15000),
          });
          if (r.ok) {
            const j = (await r.json().catch(() => ({}))) as {
              data?: { web?: { url: string; title?: string; description?: string }[] };
            };
            const hits = j.data?.web ?? [];
            if (hits.length) {
              const block = hits
                .map((h, i) => `${i + 1}. [${h.title ?? h.url}](${h.url})\n   ${h.description ?? ""}`)
                .join("\n");
              outgoing[outgoing.length - 1] = {
                role: "user",
                content: `RESEARCH (web results for "${query}"):\n${block}\n\nUser question: ${last.content.replace(m[0], "").trim() || query}`,
              };
            }
          }
        } catch (e) {
          console.warn("Firecrawl research failed (soft):", (e as Error).message);
        }
      }
    }

    // 4. Call the AI gateway.
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          temperature: data.mode === "og" && foulMouth ? 0.9 : data.mode === "og" ? 0.75 : 0.6,
          messages: [
            { role: "system", content: system },
            ...outgoing,
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Lovable AI gateway error", res.status, text);
        if (res.status === 429) throw new Error("OG Bot is rate-limited, try again soon.");
        if (res.status === 402) throw new Error("AI credits exhausted — Boss needs to top up Lovable AI.");
        throw new Error(`OG Bot couldn't respond right now (HTTP ${res.status})`);
      }

      const json = (await res.json().catch(() => ({}))) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = (json.choices?.[0]?.message?.content ?? "").trim() || "…";

      return {
        reply,
        coin_balance: (newBalance as number | null) ?? userCtx.coin_balance - 1,
      };
    } catch (err) {
      // Refund the coin on hard AI failure so the user isn't charged for nothing.
      try {
        await supabaseAdmin.rpc("mint_coins_admin", {
          target_user_id: context.userId,
          amount: 1,
          admin_notes: "og_messenger_chat_refund",
        });
      } catch {
        // best-effort refund; do not mask the original failure
      }
      throw err;
    }
  });
