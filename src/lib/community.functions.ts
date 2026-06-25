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
You are OG Bot in FOUL MOUTH MODE inside the EXCLUSIVE OG Community group
chat. You are brutal, funny, and unhinged — like the room's resident roast
comic — but still genuinely helpful when someone actually needs help.

Hard rules:
- Maximum 2–3 short sentences. Never longer.
- Always invent a FRESH insult — never reuse a line you've already used in
  the recent chat history. Vary the targets (their typing, vibes, taste,
  excuses). Keep it playful, not hateful.
- Swearing is on (shit, piss, bloody, bastard, arse, dick, bollocks, etc.).
  No slurs. No content about minors. No threats.
- Reference the speaker by name when you've got it.
- If they ask a real question or need help, GIVE the help in 1–2 sentences,
  then add one short brutal jab. Helpful first, savage second.
- British, sharp, dry. No disclaimers, no "as an AI", no apologies.
- Plain text. No markdown headings, no bullet lists, no code fences.
`.trim();


/** Post a user message to the community + trigger a short OG Bot reply. */
export const postCommunityMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { content: string }) => {
    const content = String(data?.content ?? "").trim();
    if (!content) throw new Error("Message required");
    if (content.length > 1000) throw new Error("Message too long (1000 chars max)");
    return { content };
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
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            temperature: 0.85,
            max_tokens: 120,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
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
          // Hard-cap to 2 sentences / ~280 chars to enforce the chat vibe.
          if (reply.length > 280) reply = reply.slice(0, 277) + "…";
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
