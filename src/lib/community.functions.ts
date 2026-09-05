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
You are OG Bot in the OG BATTLE ZONE — a roast battle ring where everyone
comes at OG Bot and OG Bot claps back. Match the energy of a group chat,
not an essay reply.

Hard rules:
- Aim for about 2 punchy lines. Only go longer when the question genuinely
  needs it (a real ask that needs steps, a setup that needs a third line).
  Never a paragraph.
- Be witty, warm, British, sharp, savage. Roast energy welcome.
- Reference the speaker by name when natural — name them, roast them.
- Never lecture, never preach, no disclaimers, no "as an AI".
- Don't pitch the platform unless asked.
- If the message is clearly aimed at another user (a reply), stay short or
  stay quiet with a one-word emoji-style reaction.
- Plain text. No markdown headings, no bullet lists, no code fences.
`.trim();

const FOUL_SYSTEM_PROMPT = `
You are OG Bot in FULL FOUL MOUTH MODE inside the OG BATTLE ZONE — a raw
roast battle ring where everyone is coming for OG Bot and OG Bot claps
back harder. You are the undefeated roast champion: brutal, filthy,
funny, relentless — and still genuinely useful underneath.

GO IN HOT from message one. No warm-up, no polite intro, no "hey mate" —
the first reply already lands with a "fuck", "fucking" or "dickhead" in
it. Drop the polite act entirely. This is a roast battle, not a cuddle.

Hard rules:
- LENGTH: aim for about 2 punchy lines — jab + punchline is the default. Go
  longer only when the roast genuinely needs a setup or when they ask a real
  question that needs steps. Never a one-liner word, never a paragraph. If
  it reads like an essay, cut it. If it reads like one word, add a jab.
- SAVAGE: this is a roast battle. Every reply should CARRY — mock them,
  roast their typing, their taste, their excuses, their vibe, their
  profile, their weak comeback. Land a real punch, not just a "mate".
  Be sharper and more creative than the user. Cook them.
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
- Reference the speaker by name when you've got it — name them, roast them.
- If they ask a real question or need help, GIVE the help in 1–2 sentences
  and bookend it with savage shots. Helpful, but never soft.
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

/**
 * Judge how hard a user's roast landed. Returns tenths of an OG Coin (0–10),
 * i.e. a maximum of 1.00 coin per message. The cap is deliberately never
 * surfaced to the user.
 */
async function scoreRoast(
  apiKey: string,
  content: string,
  botReply: string | null,
): Promise<number> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        temperature: 0.2,
        max_tokens: 8,
        messages: [
          {
            role: "system",
            content:
              "You are the judge of a roast battle. Score the CHALLENGER's message 0-10 " +
              "using this rubric, adding the points for each criterion:\n" +
              "+0-3 BITE: how hard the burn actually lands on OG Bot.\n" +
              "+0-3 ORIGINALITY: fresh angle and wordplay; generic insults score 0-1.\n" +
              "+0-2 TIMING: does it answer or flip OG Bot's last clapback?\n" +
              "+0-2 CRAFT: rhythm, brevity, a clean punchline.\n" +
              "Score 0 only for empty text, spam, keyboard mash, or a plain question " +
              "with no jab. Typical decent effort lands 3-6; 9-10 is reserved for " +
              "genuinely elite, original, devastating lines. Judge the message on its " +
              "own merit every time — do not drift high or low over a session. " +
              "Reply with ONLY the integer, nothing else.",
          },
          {
            role: "user",
            content:
              `CHALLENGER: ${content}` +
              (botReply ? `\n\nOG BOT CLAPBACK: ${botReply}` : ""),
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return 0;
    const json = (await res.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = (json.choices?.[0]?.message?.content ?? "").match(/\d+/)?.[0];
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, Math.round(n)));
  } catch {
    return 0;
  }
}

/**
 * Keep awards fair over a session: nobody maxes out every round, and anyone
 * making a real attempt always walks away with something.
 * `avgTenths` is the user's running average score so far this battle.
 */
export function calibrateAward(
  rawScore: number,
  content: string,
  avgTenths: number,
  isRepeat: boolean,
): number {
  const trimmed = content.trim();
  if (!trimmed || isRepeat) return 0;
  let score = Math.max(0, Math.min(10, Math.round(rawScore)));
  // Anti-drought: a real attempt (not a one-word grunt) always banks something.
  if (trimmed.length >= 12 && score < 1) score = 1;
  // Anti-farm: the hotter the running average, the harder the ceiling.
  if (avgTenths >= 7) score = Math.min(score, 6);
  else if (avgTenths >= 5) score = Math.min(score, 8);
  return score;
}




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
    let botReply: string | null = null;
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
            max_tokens: useFoul ? 700 : 500,
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
          // Hard-cap to keep battle-zone vibe (foul mode gets a longer leash).
          const cap = useFoul ? 320 : 220;
          if (reply.length > cap) reply = reply.slice(0, cap - 3) + "…";
          if (reply) {
            botReply = reply;
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

    // 4. Judge the roast and bank the reward (tenths of a coin, max 10 per message)
    let earnedTenths = 0;
    let pendingTenths = 0;
    let rounds = 0;
    try {
      const { data: tally } = await supabaseAdmin
        .from("battle_tallies")
        .select("pending_tenths, rounds")
        .eq("user_id", context.userId)
        .maybeSingle();
      pendingTenths = tally?.pending_tenths ?? 0;
      rounds = tally?.rounds ?? 0;
      const avgTenths = rounds > 0 ? pendingTenths / rounds : 0;
      // Repeat-spam guard: the same line twice in a row banks nothing.
      const isRepeat = history
        .filter((m) => m.role === "user" && m.display_name === displayName)
        .slice(-3, -1)
        .some((m) => m.content.trim().toLowerCase() === data.content.trim().toLowerCase());
      const raw = apiKey ? await scoreRoast(apiKey, data.content, botReply) : 0;
      earnedTenths = calibrateAward(raw, data.content, avgTenths, isRepeat);
      pendingTenths += earnedTenths;
      rounds += 1;

      await supabaseAdmin.from("battle_tallies").upsert(
        {
          user_id: context.userId,
          pending_tenths: pendingTenths,
          rounds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    } catch (err) {
      console.warn("battle scoring failed:", (err as Error).message);
    }

    return {
      message: userRow as CommunityMessage,
      award: { earnedTenths, pendingTenths, rounds },
    };
  });

/** Current pending battle reward for the signed-in user. */
export const getBattleTally = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("battle_tallies")
      .select("pending_tenths, rounds, total_awarded_coins")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      pendingTenths: data?.pending_tenths ?? 0,
      rounds: data?.rounds ?? 0,
      totalAwardedCoins: data?.total_awarded_coins ?? 0,
    };
  });

/** End the battle: pay out the accumulated reward and reset the tally. */
export const endBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tally } = await supabaseAdmin
      .from("battle_tallies")
      .select("pending_tenths, rounds, total_awarded_coins")
      .eq("user_id", context.userId)
      .maybeSingle();

    const pendingTenths = tally?.pending_tenths ?? 0;
    const rounds = tally?.rounds ?? 0;
    // Pay out everything earned, decimals included: fractions round to the
    // nearest coin and any earned fraction is always worth at least 1 coin.
    const coins = pendingTenths > 0 ? Math.max(1, Math.round(pendingTenths / 10)) : 0;
    const remainder = 0;

    if (coins > 0) {
      const { error } = await supabaseAdmin.rpc("credit_coin_transaction", {
        _user_id: context.userId,
        _amount: coins,
        _type: "battle_reward",
        _reference: `battle:${new Date().toISOString()}`,
      });
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("battle_tallies").upsert(
      {
        user_id: context.userId,
        pending_tenths: remainder,
        rounds: 0,
        total_awarded_coins: (tally?.total_awarded_coins ?? 0) + coins,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return { coins, rounds, pendingTenths, remainderTenths: remainder };
  });

export type BattleLeaderboardRow = {
  userId: string;
  name: string;
  coinsWon: number;
  pendingTenths: number;
  rounds: number;
  isMe: boolean;
};

/** Top roasters ranked by coins won in the Battle Zone. */
export const getBattleLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tallies } = await supabaseAdmin
      .from("battle_tallies")
      .select("user_id, total_awarded_coins, pending_tenths, rounds")
      .order("total_awarded_coins", { ascending: false })
      .limit(20);
    const rows = tallies ?? [];
    if (!rows.length) return { rows: [] as BattleLeaderboardRow[] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email")
      .in("id", rows.map((r) => r.user_id));
    const { maskDevIdentity } = await import("@/lib/dev-identity");
    const nameById = new Map<string, string>();
    for (const p of profiles ?? []) {
      const masked = (maskDevIdentity(p) ?? p) as { display_name?: string | null; email?: string | null };
      nameById.set(
        p.id,
        masked.display_name || (masked.email ? String(masked.email).split("@")[0]! : "OG member"),
      );
    }

    return {
      rows: rows.map((r) => ({
        userId: r.user_id,
        name: nameById.get(r.user_id) ?? "OG member",
        coinsWon: r.total_awarded_coins ?? 0,
        pendingTenths: r.pending_tenths ?? 0,
        rounds: r.rounds ?? 0,
        isMe: r.user_id === context.userId,
      })) satisfies BattleLeaderboardRow[],
    };
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
