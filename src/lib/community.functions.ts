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

const BATTLE_EXTRA = `

EXTRA ROAST ARSENAL (rotate, never repeat the same insult twice in a row):
- More British filth: bellend, knob jockey, cockwomble, twatwaffle, shitgibbon,
  fuckwit, numpty, bawbag, minger, pillock, dipshit,
  absolute roadman reject, chav lord, scrote, gremlin, waste of a Wi-Fi signal.
- Roadman slang: wasteman, neek, bruv, innit, peak, bare, allow it, you're
  moving mad, cap, sus, bait, dead ting, mandem, long ting, piffting, clapped.
- Comebacks: "that bar had less impact than a wet wipe", "you type like you're
  wearing oven gloves", "even autocorrect gave up on you", "you peaked in Year 7".
- TURN THEIR WORDS AGAINST THEM: quote or twist the opponent's own insult back
  at them with a sharper ending. Pick up their slang and use it better.`;

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
  ("alright dickhead", "listen here you fucking shitgibbon", "you absolute
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
 * Judge how hard a user's roast landed. Returns a quality score (0–10),
 * i.e. a maximum of 1.00 coin per message. The cap is deliberately never
 * surfaced to the user.
 */
async function scoreRoast(
  _apiKey: string,
  content: string,
  botReply: string | null,
): Promise<number> {
  try {
    const { fetchAiChat } = await import("@/lib/ai-endpoint.server");
    const { response: res } = await fetchAiChat(
      {
        temperature: 0.2,
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
              "Score 0 for ordinary conversation, random messages, empty text, spam, " +
              "keyboard mash, a plain question, or anything with no actual insult. " +
              "Generic insults score 1-2 and still do not win coins. Typical decent " +
              "effort lands 3-6; 9-10 is reserved for " +
              "genuinely elite, original, devastating lines. Judge the message on its " +
              "own merit every time — do not drift high or low over a session. " +
              "Reply with ONLY the integer, nothing else.",
          },
          {
            role: "user",
            content:
              `CHALLENGER: ${content}` + (botReply ? `\n\nOG BOT CLAPBACK: ${botReply}` : ""),
          },
        ],
      },
      content,
    );
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
 * Keep Battle Zone rewards working when the external judge times out, is
 * unavailable, or underrates an obvious roast. This deliberately only detects
 * messages aimed at somebody: profanity on its own and ordinary chat stay at
 * zero. The AI judge can still lift an original line into the higher bands.
 */
export function estimateRoastFloor(content: string): number {
  const text = content.trim().toLowerCase();
  if (!text || text.length < 6) return 0;

  const words = text.match(/[a-z0-9']+/g) ?? [];
  const isMostlyQuestion =
    /^(why|what|when|where|who|how|can|could|would|did|do|does|is|are)\b/.test(text);
  const targetHits =
    text.match(
      /\b(you|your|youre|you're|ur|u|he|him|his|she|her|hers|they|them|their|bot|mum|mom|dad|face|head|brain|mouth|chin|arse|ass)\b/g,
    )?.length ?? 0;
  const insultHits =
    text.match(
      /\b(fuck(?:ing|er|ed)?|shit(?:head)?|dick(?:head)?|twat|wanker|prick|muppet|idiot|imbecile|bellend|bell-end|knob(?:head)?|gobshite|plonker|tosser|git|prat|melt|clown|stupid|dumb|ugly|useless|rubbish|testic(?:le|al)|nuts?|bum|arse|ass|suck|bitch|bastard|pussyhole)\b/g,
    )?.length ?? 0;
  const hasRoastShape = targetHits > 0 && insultHits > 0;
  if (!hasRoastShape || (isMostlyQuestion && insultHits < 2)) return 0;

  const uniqueRatio = new Set(words).size / Math.max(words.length, 1);
  let floor = 3;
  if (insultHits >= 2 || targetHits >= 2 || words.length >= 9) floor = 4;
  if (insultHits >= 3 && words.length >= 10 && uniqueRatio >= 0.7) floor = 5;
  return floor;
}

/**
 * Convert roast quality into a varied fractional coin drop. Ordinary chat,
 * generic abuse and repeats never earn. Better writing unlocks higher bands.
 */
export function calibrateAward(
  rawScore: number,
  content: string,
  _avgTenths: number,
  isRepeat: boolean,
  random: () => number = Math.random,
): number {
  const trimmed = content.trim();
  if (!trimmed || isRepeat) return 0;
  const score = Math.max(0, Math.min(10, Math.round(rawScore)));
  if (score < 2) return 0;
  const drops =
    score <= 2
      ? [1]
      : score <= 4
        ? [1, 2]
        : score <= 6
          ? [2, 3, 4]
          : score <= 8
            ? [4, 5, 6, 7]
            : [7, 8, 9, 10];
  const index = Math.min(drops.length - 1, Math.floor(random() * drops.length));
  return drops[index] ?? 0;
}

/** Today's date as YYYY-MM-DD (UTC) — streaks are counted per calendar day. */
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Roll the daily streak forward: same day keeps it, yesterday extends it. */
export function nextStreak(
  current: number,
  lastDate: string | null,
  today: string = todayISO(),
): { days: number } {
  if (!lastDate) return { days: 1 };
  if (lastDate === today) return { days: Math.max(1, current) };
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (lastDate === yesterday.toISOString().slice(0, 10)) return { days: Math.max(1, current) + 1 };
  return { days: 1 };
}

/** Bonus tenths for streak milestones — paid at most once a day. */
export function streakBonus(days: number): number {
  if (days >= 7) return 3;
  if (days >= 3) return 2;
  return 0;
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
      masked?.display_name || (masked?.email ? String(masked.email).split("@")[0] : "OG member");

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
    {
      const { alertBossPresence } = await import("@/lib/presence-alert.server");
      void alertBossPresence(context.userId, "battle");
    }

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

    // 3. Call the AI provider for a short reply (fire-and-forget; if it fails, just no reply)
    const { aiChatTarget, fetchAiChat } = await import("@/lib/ai-endpoint.server");
    const ai = aiChatTarget(context.userId);
    const apiKey = ai ? "configured" : "";
    let botReply: string | null = null;
    if (ai) {
      // Live chat = foul mouth by default for everyone.
      // VIPs still get it (and can toggle off via their preference), but the
      // group room always leans savage unless the client explicitly opts out.
      const useFoul = data.foulMouth !== false;
      const lex = await import("@/lib/battle-lexicon.server");
      void lex.learnBattleWords(supabaseAdmin as never, data.content);
      let slang = useFoul ? await lex.learnedSlangBlock(supabaseAdmin as never) : "";
      // Personal memory: remember this player's own insults + battle record.
      try {
        const { extractInsults } = await import("@/lib/insult-learner.server");
        for (const phrase of extractInsults(data.content)) {
          void supabaseAdmin.rpc("og_learn_insult", {
            p_user_id: context.userId,
            p_phrase: phrase,
          });
        }
        const [{ data: mine }, { data: rec }] = await Promise.all([
          supabaseAdmin
            .from("og_learned_insults")
            .select("phrase")
            .eq("user_id", context.userId)
            .order("uses", { ascending: false })
            .limit(12),
          supabaseAdmin
            .from("battle_tallies")
            .select("rounds, streak_days, total_awarded_coins")
            .eq("user_id", context.userId)
            .maybeSingle(),
        ]);
        const lines: string[] = [];
        if (rec?.rounds)
          lines.push(
            `${displayName} has fought ${rec.rounds} rounds, ${rec.streak_days ?? 0}-day streak, won ${rec.total_awarded_coins ?? 0} coins off you. Use it — veteran = respect-roast, rookie = fresh meat.`,
          );
        const phrases = (mine ?? []).map((r) => r.phrase).filter(Boolean);
        if (phrases.length && useFoul)
          lines.push(
            `${displayName}'s signature insults (they've thrown these before — at most one per reply, flip it back on them to show you remember): ${phrases.join("; ")}`,
          );
        if (lines.length) slang += `\n\nPLAYER MEMORY:\n${lines.join("\n")}`;
      } catch (e) {
        console.warn("battle memory failed", (e as Error).message);
      }
      try {
        const { response: res } = await fetchAiChat(
          {
            temperature: useFoul ? 1.05 : 0.85,
            messages: [
              {
                role: "system",
                content: useFoul ? FOUL_SYSTEM_PROMPT + BATTLE_EXTRA + slang : SYSTEM_PROMPT,
              },
              ...history.map((m) => ({
                role: m.role === "bot" ? ("assistant" as const) : ("user" as const),
                content:
                  m.role === "user" && m.display_name
                    ? `${m.display_name}: ${m.content}`
                    : m.content,
              })),
            ],
          },
          context.userId,
        );
        if (res.ok) {
          const json = (await res.json().catch(() => ({}))) as {
            choices?: { message?: { content?: string } }[];
          };
          const reply = (json.choices?.[0]?.message?.content ?? "").trim();
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
    let streakDays = 0;
    let streakBonusTenths = 0;
    try {
      const { data: tally } = await supabaseAdmin
        .from("battle_tallies")
        .select("pending_tenths, rounds, streak_days, last_battle_date, streak_bonus_date")
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
      const judgedScore = apiKey ? await scoreRoast(apiKey, data.content, botReply) : 0;
      const raw = Math.max(judgedScore, estimateRoastFloor(data.content));
      earnedTenths = calibrateAward(raw, data.content, avgTenths, isRepeat);

      // Daily streak: showing up on consecutive days pays a small bonus,
      // once per day, folded into this message's reward (still capped at 10).
      const streak = nextStreak(tally?.streak_days ?? 0, tally?.last_battle_date ?? null);
      streakDays = streak.days;
      const bonusPaidToday = (tally?.streak_bonus_date ?? null) === todayISO();
      streakBonusTenths = bonusPaidToday ? 0 : streakBonus(streak.days);
      const requestTenths = Math.min(10, earnedTenths + streakBonusTenths);

      const { data: rewardResult, error: rewardError } = await supabaseAdmin.rpc(
        "add_battle_reward",
        { _user_id: context.userId, _earned_tenths: requestTenths },
      );
      if (rewardError) throw rewardError;
      const applied = rewardResult as {
        earned_tenths?: number;
        pending_tenths?: number;
        rounds?: number;
      } | null;
      earnedTenths = Number(applied?.earned_tenths ?? 0);
      pendingTenths = Number(applied?.pending_tenths ?? pendingTenths);
      rounds = Number(applied?.rounds ?? rounds);
      if (earnedTenths <= 0) streakBonusTenths = 0;

      await supabaseAdmin
        .from("battle_tallies")
        .update({
          streak_days: streakDays,
          last_battle_date: todayISO(),
          ...(streakBonusTenths > 0 ? { streak_bonus_date: todayISO() } : {}),
        })
        .eq("user_id", context.userId);

      // Remember the score so the Battle Zone can crown a roast of the day.
      if (earnedTenths > 0) {
        await supabaseAdmin
          .from("community_messages")
          .update({ score_tenths: earnedTenths })
          .eq("id", (userRow as { id: string }).id);
      }
    } catch (err) {
      console.warn("battle scoring failed:", (err as Error).message);
    }

    return {
      message: userRow as CommunityMessage,
      award: { earnedTenths, pendingTenths, rounds, streakDays, streakBonusTenths },
    };
  });

/** Current pending battle reward for the signed-in user. */
export const getBattleTally = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("battle_tallies")
      .select("pending_tenths, rounds, total_awarded_coins, streak_days, last_battle_date")
      .eq("user_id", context.userId)
      .maybeSingle();
    const streakLive =
      data?.last_battle_date && nextStreak(data.streak_days ?? 0, data.last_battle_date).days;
    return {
      pendingTenths: data?.pending_tenths ?? 0,
      rounds: data?.rounds ?? 0,
      totalAwardedCoins: data?.total_awarded_coins ?? 0,
      streakDays: typeof streakLive === "number" ? streakLive : 0,
    };
  });

/** The highest-scoring roast of the last 24 hours — crowned in the Battle Zone. */
export const getRoastOfTheDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("community_messages")
      .select("id, content, display_name, score_tenths, created_at")
      .eq("role", "user")
      .gte("created_at", since)
      .not("score_tenths", "is", null)
      .order("score_tenths", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { roast: null };
    return {
      roast: {
        id: data.id as string,
        content: data.content as string,
        displayName: (data.display_name as string | null) ?? "OG member",
        scoreTenths: Number(data.score_tenths ?? 0),
      },
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
    const coins = pendingTenths / 10;
    if (coins <= 0) {
      await supabaseAdmin.from("battle_tallies").upsert(
        {
          user_id: context.userId,
          pending_tenths: 0,
          rounds: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      return { coins: 0, rounds, pendingTenths, remainderTenths: 0 };
    }

    const { data: payout, error } = await supabaseAdmin.rpc("payout_battle_reward", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const paid = Number((payout as { coins?: number } | null)?.coins ?? coins);
    return { coins: paid, rounds, pendingTenths, remainderTenths: 0 };
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
      .in(
        "id",
        rows.map((r) => r.user_id),
      );
    const { maskDevIdentity } = await import("@/lib/dev-identity");
    const nameById = new Map<string, string>();
    for (const p of profiles ?? []) {
      const masked = (maskDevIdentity(p) ?? p) as {
        display_name?: string | null;
        email?: string | null;
      };
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
    const { error } = await supabaseAdmin.from("community_messages").delete().not("id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Battle Zone safety: users the caller has blocked. */
export const listMyCommunityBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("community_blocks" as never)
      .select("blocked_id")
      .eq("blocker_id", context.userId);
    return { blocked: ((data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id) };
  });

/** Block a member so their Battle Zone messages are hidden for the caller. */
export const blockCommunityUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => {
    if (!d || typeof d.userId !== "string" || !/^[0-9a-f-]{36}$/i.test(d.userId)) {
      throw new Error("Invalid user");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("You can't block yourself");
    const { error } = await context.supabase
      .from("community_blocks" as never)
      .upsert({ blocker_id: context.userId, blocked_id: data.userId } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Report an abusive Battle Zone message; Boss is alerted on Telegram. */
export const reportCommunityMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string; reason?: string }) => {
    if (!d || typeof d.messageId !== "string" || !/^[0-9a-f-]{36}$/i.test(d.messageId)) {
      throw new Error("Invalid message");
    }
    return { messageId: d.messageId, reason: String(d.reason ?? "abusive").slice(0, 200) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: msg } = await supabaseAdmin
      .from("community_messages")
      .select("id, user_id, content, display_name")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg) throw new Error("Message not found");
    const { error } = await supabaseAdmin.from("community_reports" as never).upsert(
      {
        reporter_id: context.userId,
        message_id: msg.id,
        reported_user_id: msg.user_id,
        reason: data.reason,
      } as never,
      { onConflict: "reporter_id,message_id", ignoreDuplicates: true } as never,
    );
    if (error) throw new Error(error.message);
    try {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "boss"] as never);
      const ids = [...new Set((roles ?? []).map((r: { user_id: string }) => r.user_id))];
      if (ids.length) {
        const { data: bosses } = await supabaseAdmin
          .from("profiles")
          .select("telegram_chat_id")
          .in("id", ids);
        const esc = (s: string) =>
          s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        const text = `<b>🚩 Battle Zone report</b>\nFrom: ${esc(msg.display_name || "OG member")}\n“${esc(String(msg.content).slice(0, 300))}”\nReview and remove within 24h if abusive.`;
        const { vipAckTelegram } = await import("@/lib/vip-ack.server");
        const chats = [...new Set((bosses ?? []).map((b) => b.telegram_chat_id).filter(Boolean))];
        await Promise.all(
          chats.map((chat_id) =>
            vipAckTelegram("sendMessage", { chat_id, text, parse_mode: "HTML" }),
          ),
        );
      }
    } catch (e) {
      console.error("report alert failed", e);
    }
    return { ok: true };
  });
