import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSystemPrompt, type UserContextSummary } from "@/lib/og-persona";
import { extractInsults } from "@/lib/insult-learner";

export type OgChatMessage = { role: "user" | "assistant"; content: string };


interface ChatReply {
  reply: string;
  coin_balance: number;
  learned_insults?: string[];
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
  .inputValidator((data: { messages: OgChatMessage[]; pageContext?: string; mode?: "safe" | "og"; attachmentDataUrl?: string }) => {
    if (!data || !Array.isArray(data.messages)) throw new Error("messages required");
    const messages = data.messages.slice(-30).map((m) => ({
      role: m.role === "assistant" ? "assistant" as const : "user" as const,
      content: String(m.content ?? "").slice(0, 4000),
    }));
    if (messages.length === 0) throw new Error("Empty conversation");
    const pageContext =
      typeof data.pageContext === "string" ? data.pageContext.slice(0, 200) : "";
    const mode: "safe" | "og" = data.mode === "safe" ? "safe" : "og";
    let attachmentDataUrl: string | undefined;
    if (typeof data.attachmentDataUrl === "string" && data.attachmentDataUrl.startsWith("data:image/")) {
      if (data.attachmentDataUrl.length > 8_000_000) throw new Error("Image too large (max ~6MB).");
      attachmentDataUrl = data.attachmentDataUrl;
    }
    return { messages, pageContext, mode, attachmentDataUrl };
  })
  .handler(async ({ data, context }): Promise<ChatReply> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Load user context in parallel (profile, role flags, foul pref, persona overrides, learned insults).
    const [profileRes, rolesRes, prefRes, siteRes, learnedRes] = await Promise.all([
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
      supabaseAdmin
        .from("og_learned_insults")
        .select("phrase, uses")
        .eq("user_id", context.userId)
        .order("last_seen_at", { ascending: false })
        .limit(40),
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
    const foulMouth = prefRes.data?.foul_mouth ?? false;

    const userCtx: UserContextSummary = {
      display_name: profile.display_name,
      email: profile.email,
      coin_balance: profile.coin_balance ?? 0,
      is_admin: roles.includes("admin"),
      is_vip: roles.includes("vip"),
      page_context: data.pageContext || undefined,
    };

    const learnedInsults = (learnedRes.data ?? []).map((r: { phrase: string }) => r.phrase);

    const system = buildSystemPrompt({
      mode: data.mode,
      foulMouth,
      bossScript: personaMap.get("og_persona.script") ?? null,
      bossVoice: personaMap.get("og_persona.voice") ?? null,
      bossDictionary: personaMap.get("og_persona.dictionary") ?? null,
      learnedInsults,
      user: userCtx,
    });

    // 1b. Learn fresh insults from the latest user message (fire-and-forget upsert).
    let newlyLearned: string[] = [];
    if (data.mode === "og" && foulMouth) {
      const latestUser = [...data.messages].reverse().find((m) => m.role === "user");
      if (latestUser) {
        const candidates = extractInsults(latestUser.content);
        if (candidates.length) {
          newlyLearned = candidates;
          // Upsert each phrase, bumping uses + last_seen_at.
          await Promise.all(
            candidates.map((phrase) =>
              supabaseAdmin.rpc("og_learn_insult", {
                p_user_id: context.userId,
                p_phrase: phrase,
              }).then((r) => {
                if (r.error) console.warn("learn insult failed:", r.error.message);
              }),
            ),
          ).catch(() => {});
        }
      }
    }

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
            ...outgoing.slice(0, -1),
            // Last user message: if an image attachment was sent, build a
            // multimodal content array so Gemini can actually see the image.
            data.attachmentDataUrl && outgoing.at(-1)?.role === "user"
              ? {
                  role: "user" as const,
                  content: [
                    { type: "text", text: outgoing.at(-1)!.content || "What's in this image?" },
                    { type: "image_url", image_url: { url: data.attachmentDataUrl } },
                  ],
                }
              : outgoing.at(-1)!,
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
