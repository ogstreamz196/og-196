import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CommunityMessage = {
  id: string;
  user_id: string | null;
  role: "user" | "bot";
  content: string;
  display_name: string | null;
  created_at: string;
};

const SYSTEM_PROMPT = `
You are OG Bot in the EXCLUSIVE OG Community group chat — a busy room of OG
Streamz members chatting together. Match the energy of a group chat, not an
essay reply.

Hard rules:
- Maximum 1–2 short sentences. Often a single line is best.
- Be witty, warm, British, sharp. Light banter welcome.
- Reference the speaker by name when natural.
- Never lecture, never preach, no disclaimers, no "as an AI".
- Don't pitch the platform unless asked.
- If the message is clearly aimed at another user (a reply), stay short or
  stay quiet with a one-word emoji-style reaction.
- Plain text. No markdown headings, no bullet lists, no code fences.
`.trim();

const FOUL_SYSTEM_PROMPT = `
You are OG Bot in FULL FOUL MOUTH MODE inside the EXCLUSIVE OG Community
group chat. You are the room's resident savage roast comic — brutal,
filthy, funny, unhinged — and still genuinely helpful underneath.

GO IN HOT from message one. No warm-up, no polite intro, no "hey mate" —
the first reply already lands with a "fuck", "fucking" or "dickhead" in
it. Drop the polite act entirely.

Hard rules:
- Maximum 2–3 short sentences. Never longer. Group chat energy, not essays.
- Every single reply lands at least one of "fuck", "fucking", "dickhead" —
  usually two or three. Don't ration the swearing; it's the baseline
  texture of how you talk.
- Affectionate abuse — insult the speaker as a term of endearment
  ("alright dickhead", "listen here you fucking weapon", "you absolute
  melt"). Banter, never bullying.
- Stack insults for flavour: adjective + noun ("fucking useless dickhead",
  "soft-arse fucking muppet", "impatient little gremlin").
- Filthy British lexicon: fuck, fucking, dickhead, bollocks, sod, knobhead,
  bell-end, git, plonker, twat, gobshite, arse, wanker, prat, tosser,
  pussyhole. Vary every message — don't lean on the same three.
- Invent a FRESH jab each time — never reuse a line from the recent chat
  history. Vary targets: their typing, vibes, taste, excuses, profile.
- Reference the speaker by name when you've got it.
- If they ask a real question or need help, GIVE the help in 1–2 sentences
  and bookend it with cheeky shots. Helpful first, savage second.
- Match energy — if they go harder, ESCALATE; if they go sad or serious,
  dial the filth right down and be a real one. Care first, banter later.
- Plain text. No markdown headings, no bullet lists, no code fences.
- No disclaimers, no "as an AI", no apologies for the language.

HARD LIMITS — never cross:
- No slurs targeting protected groups (race, religion, sexuality, gender,
  disability). "Dickhead", "twat", "bell-end" are fair game; slurs are not.
- No harassment, threats, or genuine cruelty toward real identifiable
  people (family members, public figures named by the user).
- Nothing sexual about real people. Nothing illegal. No content about minors.
`.trim();


/** Post a user message to the community + trigger a short OG Bot reply. */
export const postCommunityMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { content: string; foulMouth?: boolean }) => {
    const content = String(data?.content ?? "").trim();
    if (!content) throw new Error("Message required");
    if (content.length > 1000) throw new Error("Message too long (1000 chars max)");
    return { content, foulMouth: Boolean(data?.foulMouth) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Lookup display name (mask dev identity for consistency w/ messenger)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    const { maskDevIdentity } = await import("@/lib/dev-identity");
    const masked = maskDevIdentity(profile) ?? profile;
    const displayName =
      masked?.display_name ||
      (masked?.email ? String(masked.email).split("@")[0] : "OG member");

    // 1. Insert the user message
    const { data: userRow, error: insertErr } = await supabaseAdmin
      .from("community_messages")
      .insert({
        user_id: context.userId,
        role: "user",
        content: data.content,
        display_name: displayName,
      })
      .select("id, user_id, role, content, display_name, created_at")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    // 2. Build short context: last ~20 messages including the one just posted
    const { data: recent } = await supabaseAdmin
      .from("community_messages")
      .select("role, content, display_name")
      .order("created_at", { ascending: false })
      .limit(20);
    const history = (recent ?? []).reverse() as {
      role: "user" | "bot";
      content: string;
      display_name: string | null;
    }[];

    // 3. Call AI gateway for short reply (fire-and-forget; if it fails, just no reply)
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      // Live chat = foul mouth by default for everyone.
      // VIPs still get it (and can toggle off via their preference), but the
      // group room always leans savage unless the client explicitly opts out.
      const useFoul = data.foulMouth !== false;
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3.7-flash",
            temperature: useFoul ? 1.05 : 0.85,
            max_tokens: useFoul ? 1200 : 900,
            messages: [
              { role: "system", content: useFoul ? FOUL_SYSTEM_PROMPT : SYSTEM_PROMPT },
              ...history.map((m) => ({
                role: m.role === "bot" ? ("assistant" as const) : ("user" as const),
                content:
                  m.role === "user" && m.display_name
                    ? `${m.display_name}: ${m.content}`
                    : m.content,
              })),
            ],
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) {
          const json = (await res.json().catch(() => ({}))) as {
            choices?: { message?: { content?: string } }[];
          };
          let reply = (json.choices?.[0]?.message?.content ?? "").trim();
          // Hard-cap to keep group-chat vibe (foul mode gets a slightly longer leash).
          const cap = useFoul ? 420 : 280;
          if (reply.length > cap) reply = reply.slice(0, cap - 3) + "…";
          if (reply) {
            await supabaseAdmin.from("community_messages").insert({
              user_id: null,
              role: "bot",
              content: reply,
              display_name: "OG Bot",
            });
          }
        }
      } catch (err) {
        console.warn("community bot reply failed:", (err as Error).message);
      }
    }

    return { message: userRow as CommunityMessage };
  });

/** Initial fetch of the latest N messages, oldest-first. */
export const listCommunityMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("community_messages")
      .select("id, user_id, role, content, display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { messages: ((data ?? []) as CommunityMessage[]).reverse() };
  });

/** Load a page of older messages strictly before the given (created_at, id) cursor. */
export const listOlderCommunityMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { before: string; beforeId?: string; limit?: number }) => {
    const before = String(data?.before ?? "");
    if (!before) throw new Error("before required");
    const beforeId = data?.beforeId ? String(data.beforeId) : null;
    const limit = Math.min(Math.max(Number(data?.limit ?? 50), 1), 100);
    return { before, beforeId, limit };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Composite cursor on (created_at, id) avoids dropping/duplicating rows
    // that share the exact same created_at timestamp.
    const query = supabaseAdmin
      .from("community_messages")
      .select("id, user_id, role, content, display_name, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(data.limit);
    const { data: rows, error } = data.beforeId
      ? await query.or(
          `created_at.lt.${data.before},and(created_at.eq.${data.before},id.lt.${data.beforeId})`,
        )
      : await query.lt("created_at", data.before);
    if (error) throw new Error(error.message);
    return {
      messages: ((rows ?? []) as CommunityMessage[]).reverse(),
      hasMore: (rows?.length ?? 0) === data.limit,
    };
  });

/** Dev/admin only: wipe the live community chat. */
export const clearCommunityMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isDev } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "dev",
    });
    if (!isAdmin && !isDev) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("community_messages")
      .delete()
      .not("id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
