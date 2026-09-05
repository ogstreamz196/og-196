import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { buildSystemPrompt, detectSongIntent } from "@/lib/og-persona.server";
import type { UserContextSummary } from "@/lib/og-persona-public";

// Accepted tokens:
//   - Rotated, single-use: "t_" + 32 lowercase hex chars (matched against
//     profiles.telegram_link_token).
//   - Legacy deterministic: 24 lowercase hex (first 24 chars of profiles.id
//     without dashes).
const TOKEN_RE = /^(t_[a-f0-9]{32}|[a-f0-9]{24})$/;
const BOSS_TELEGRAM_USERNAMES = ["ogstreamz", "ogstreamz196"] as const;
const BOSS_TELEGRAM_USERNAME = BOSS_TELEGRAM_USERNAMES[0];
const BOSS_EMAIL = "ogstreamz196@gmail.com";

function deriveSecret(key: string): string {
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const la = Buffer.from(a);
  const lb = Buffer.from(b);
  return la.length === lb.length && timingSafeEqual(la, lb);
}

function tokenToUuidPrefix(token: string): string {
  return `${token.slice(0, 8)}-${token.slice(8, 12)}-${token.slice(12, 16)}-${token.slice(16, 20)}-${token.slice(20, 24)}`;
}

function tokenToUuidRange(token: string): { min: string; max: string } {
  const base = tokenToUuidPrefix(token);
  return {
    min: `${base}00000000`,
    max: `${base}ffffffff`,
  };
}

async function tg(method: string, body: Record<string, unknown>) {
  const tgKey = process.env.TELEGRAM_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!tgKey || !lovableKey) return null;
  const r = await fetch(`https://connector-gateway.lovable.dev/telegram/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": tgKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => null);
  return r;
}

async function reply(chat_id: number, text: string, extra?: Record<string, unknown>) {
  await tg("sendMessage", {
    chat_id,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(extra ?? {}),
  });
}

// Persistent reply keyboards — one row of quick actions.
const USER_KEYBOARD = {
  keyboard: [
    [{ text: "💰 Balance" }, { text: "🎧 Library" }],
    [{ text: "🛒 Buy Coins" }, { text: "👤 My Profile" }],
    [{ text: "❓ Help" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const BOSS_KEYBOARD = {
  keyboard: [
    [{ text: "🟢 Online Now" }, { text: "🕒 Last Seen" }],
    [{ text: "📊 Stats" }, { text: "👥 Users" }],
    [{ text: "💰 Balance" }, { text: "❓ Help" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const HELP_USER = `🤖 <b>OG Bot menu</b>
Tap a button below or use a command:

/balance — your OG coin balance
/library — jump into your song library
/buy — top up OG coins
/me — your linked profile
/help — this menu

Just type anything else and I'll answer — same brain as the in-app messenger.`;

const HELP_ADMIN = `${HELP_USER}

👑 <b>Boss / admin commands</b>
/online [minutes] — who's on site right now (default 5)
/lastseen — 20 most recent visitors + their last menu item
/user &lt;email|uuid&gt; — full snapshot (balance, VIP, last activity)
/users [query] — search profiles
/whois &lt;email|uuid&gt; — quick profile
/addcoins &lt;who&gt; &lt;amount&gt; [reason]
/setcoins &lt;who&gt; &lt;amount&gt; [reason]
/stats — platform snapshot
/broadcast &lt;msg&gt; — DM every linked user`;

type AdminProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
  coin_balance: number | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  last_activity_at?: string | null;
  last_path?: string | null;
  last_label?: string | null;
};

const PROFILE_COLS =
  "id, display_name, email, coin_balance, telegram_chat_id, telegram_username, last_activity_at, last_path, last_label";

async function findProfile(
  admin: Awaited<ReturnType<typeof loadAdmin>>,
  needle: string,
): Promise<AdminProfile | null> {
  const v = needle.trim().replace(/^@/, "");
  // UUID?
  if (/^[0-9a-f-]{32,36}$/i.test(v)) {
    const { data } = await admin
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", v)
      .maybeSingle();
    if (data) return data as AdminProfile;
  }
  const { data } = await admin
    .from("profiles")
    .select(PROFILE_COLS)
    .or(`email.ilike.${v},display_name.ilike.${v},telegram_username.ilike.${v}`)
    .limit(2);
  if (data && data.length === 1) return data[0] as AdminProfile;
  return null;
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function isAdmin(admin: Awaited<ReturnType<typeof loadAdmin>>, userId: string) {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  return { admin: roles.includes("admin") || roles.includes("dev"), roles };
}

async function verifyTelegramChat(chat_id: number): Promise<boolean> {
  const verifyRes = await tg("getChat", { chat_id });
  const verifyJson = verifyRes
    ? ((await verifyRes.json().catch(() => null)) as {
        ok?: boolean;
        result?: { id?: number };
      } | null)
    : null;
  return (
    !!verifyRes &&
    verifyRes.ok &&
    verifyJson?.ok === true &&
    Number(verifyJson?.result?.id) === Number(chat_id)
  );
}

async function maybeBootstrapBossTelegram(
  admin: Awaited<ReturnType<typeof loadAdmin>>,
  chat_id: number,
  msg: {
    chat?: { type?: string };
    from?: { id?: number; username?: string; first_name?: string };
  },
): Promise<boolean> {
  if (chat_id <= 0 || msg?.chat?.type !== "private" || Number(msg?.from?.id) !== chat_id) {
    return false;
  }

  const username = msg?.from?.username?.trim().replace(/^@/, "").toLowerCase();
  if (!username || !BOSS_TELEGRAM_USERNAMES.includes(username as (typeof BOSS_TELEGRAM_USERNAMES)[number])) return false;

  const { data: boss } = await admin
    .from("profiles")
    .select("id, display_name, email, coin_balance")
    .eq("email", BOSS_EMAIL)
    .maybeSingle();
  if (!boss?.id) return false;

  const { admin: isBoss } = await isAdmin(admin, boss.id as string);
  if (!isBoss) return false;

  const chatVerified = await verifyTelegramChat(chat_id);
  if (!chatVerified) {
    await reply(
      chat_id,
      "⚠️ I found Boss, but Telegram chat verification failed. Tap Start again in a moment.",
    );
    return true;
  }

  const { error } = await admin
    .from("profiles")
    .update({
      telegram_chat_id: chat_id,
      telegram_username: msg?.from?.username ?? BOSS_TELEGRAM_USERNAME,
      telegram_linked_at: new Date().toISOString(),
      telegram_link_token: null,
    })
    .eq("id", boss.id as string);

  if (error) {
    await reply(chat_id, `❌ Boss Telegram link failed: ${error.message}`);
    return true;
  }

  await admin.from("telegram_sign_in_events").insert({
    user_id: boss.id as string,
    chat_id,
    telegram_username: msg?.from?.username ?? BOSS_TELEGRAM_USERNAME,
    telegram_first_name: (msg?.from?.first_name as string | undefined) ?? null,
    event_kind: "boss_link",
    source: "webhook_start",
  }).then(() => undefined, () => undefined);

  await reply(
    chat_id,
    `✅ <b>Connected!</b> OG Bot is linked to your account.\n\n👑 <b>Boss verified.</b> OG Bot is wired to this Telegram now.\n\n💰 Balance: <b>${boss.coin_balance ?? 0}</b> OG coins\nTap a button below or type /help.`,
    { reply_markup: BOSS_KEYBOARD },
  );
  return true;
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "never";
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isOnline(iso: string | null | undefined, minutes = 3): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < minutes * 60_000;
}

function fmtProfile(p: AdminProfile): string {
  const online = isOnline(p.last_activity_at) ? "🟢 Online" : "⚪ Offline";
  return [
    `<b>${p.display_name ?? "(no name)"}</b>  ${online}`,
    p.email ? `📧 ${p.email}` : null,
    `🆔 <code>${p.id}</code>`,
    `💰 ${p.coin_balance ?? 0} OG coins`,
    p.telegram_username ? `✈️ @${p.telegram_username}` : null,
    p.last_activity_at
      ? `🕒 Last seen: ${relTime(p.last_activity_at)}${p.last_label ? ` · <i>${p.last_label}</i>` : ""}${p.last_path ? ` (<code>${p.last_path}</code>)` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function runAdminCommand(
  admin: Awaited<ReturnType<typeof loadAdmin>>,
  chat_id: number,
  text: string,
): Promise<boolean> {
  const [cmd, ...rest] = text.trim().split(/\s+/);
  const arg = rest.join(" ");

  if (cmd === "/online") {
    const mins = Math.max(1, Math.min(1440, parseInt(rest[0] ?? "5", 10) || 5));
    const { data, error } = await admin.rpc("boss_get_online_users", { p_minutes: mins });
    if (error) {
      await reply(chat_id, `❌ ${error.message}`);
      return true;
    }
    const rows = (data ?? []) as AdminProfile[];
    if (!rows.length) {
      await reply(chat_id, `😴 No users active in the last ${mins} min.`);
      return true;
    }
    const list = rows
      .map((p, i) => {
        const dot = isOnline(p.last_activity_at, 3) ? "🟢" : "🟡";
        const who = p.display_name ?? p.email ?? p.id.slice(0, 8);
        const where = p.last_label ?? "—";
        return `${i + 1}. ${dot} <b>${who}</b> — <i>${where}</i>\n   🕒 ${relTime(p.last_activity_at)} · 💰${p.coin_balance ?? 0}`;
      })
      .join("\n");
    await reply(chat_id, `🟢 <b>Online in last ${mins} min</b> (${rows.length})\n\n${list}`);
    return true;
  }

  if (cmd === "/lastseen" || cmd === "/recent") {
    const { data, error } = await admin
      .from("profiles")
      .select(PROFILE_COLS)
      .not("last_activity_at", "is", null)
      .order("last_activity_at", { ascending: false })
      .limit(20);
    if (error) {
      await reply(chat_id, `❌ ${error.message}`);
      return true;
    }
    const rows = (data ?? []) as AdminProfile[];
    if (!rows.length) {
      await reply(chat_id, "No activity recorded yet.");
      return true;
    }
    const list = rows
      .map((p, i) => {
        const dot = isOnline(p.last_activity_at, 3) ? "🟢" : "⚪";
        const who = p.display_name ?? p.email ?? p.id.slice(0, 8);
        return `${i + 1}. ${dot} <b>${who}</b> — <i>${p.last_label ?? "—"}</i> · ${relTime(p.last_activity_at)}`;
      })
      .join("\n");
    await reply(chat_id, `🕒 <b>Recent visitors</b>\n\n${list}`);
    return true;
  }

  if (cmd === "/user" || cmd === "/inspect") {
    if (!arg) {
      await reply(chat_id, "Usage: /user &lt;email|uuid|@handle&gt;");
      return true;
    }
    const p = await findProfile(admin, arg);
    if (!p) {
      await reply(chat_id, `No unique match for "${arg}".`);
      return true;
    }
    // Pull last 5 activity rows for a menu-trail
    const { data: trail } = await admin
      .from("user_activity_log")
      .select("label, path, action, created_at")
      .eq("user_id", p.id)
      .order("created_at", { ascending: false })
      .limit(5);
    const trailStr =
      (trail ?? [])
        .map(
          (t: { label: string | null; path: string | null; action: string; created_at: string }) =>
            `• ${relTime(t.created_at)} — <i>${t.label ?? t.path ?? t.action}</i>`,
        )
        .join("\n") || "• (no menu clicks recorded yet)";
    await reply(chat_id, `${fmtProfile(p)}\n\n🧭 <b>Last actions</b>\n${trailStr}`);
    return true;
  }



  if (cmd === "/users" || cmd === "/find") {
    const q = arg.trim();
    const query = admin
      .from("profiles")
      .select(PROFILE_COLS)
      .order("created_at", { ascending: false })
      .limit(10);
    const { data, error } = q
      ? await admin
          .from("profiles")
          .select(PROFILE_COLS)
          .or(`email.ilike.%${q}%,display_name.ilike.%${q}%,telegram_username.ilike.%${q}%`)
          .limit(10)
      : await query;
    if (error) {
      await reply(chat_id, `❌ ${error.message}`);
      return true;
    }
    const rows = (data ?? []) as AdminProfile[];
    if (!rows.length) {
      await reply(chat_id, "No profiles matched.");
      return true;
    }
    const list = rows
      .map(
        (p, i) =>
          `${i + 1}. <b>${p.display_name ?? "(no name)"}</b> — ${p.email ?? "no email"} · 💰${p.coin_balance ?? 0}\n   <code>${p.id}</code>`,
      )
      .join("\n");
    await reply(chat_id, `👥 <b>Profiles</b>${q ? ` matching "${q}"` : ""}:\n\n${list}`);
    return true;
  }

  if (cmd === "/whois") {
    if (!arg) {
      await reply(chat_id, "Usage: /whois &lt;email|uuid&gt;");
      return true;
    }
    const p = await findProfile(admin, arg);
    if (!p) {
      await reply(chat_id, `No unique match for "${arg}".`);
      return true;
    }
    await reply(chat_id, fmtProfile(p));
    return true;
  }

  if (cmd === "/addcoins" || cmd === "/setcoins") {
    const m = arg.match(/^(\S+)\s+(-?\d+)(?:\s+(.+))?$/);
    if (!m) {
      await reply(chat_id, `Usage: ${cmd} &lt;email|uuid&gt; &lt;amount&gt; [reason]`);
      return true;
    }
    const [, who, amtStr, reason] = m;
    const amount = parseInt(amtStr, 10);
    const target = await findProfile(admin, who);
    if (!target) {
      await reply(chat_id, `No unique match for "${who}".`);
      return true;
    }
    const note = (reason ?? `telegram_${cmd.slice(1)}`).slice(0, 200);
    let newBalance: number | null = null;
    if (cmd === "/addcoins") {
      if (amount === 0) {
        await reply(chat_id, "Amount must be non-zero.");
        return true;
      }
      const updated = Math.max(0, (target.coin_balance ?? 0) + amount);
      const { error: upErr } = await admin
        .from("profiles")
        .update({ coin_balance: updated })
        .eq("id", target.id);
      if (upErr) {
        await reply(chat_id, `❌ ${upErr.message}`);
        return true;
      }
      await admin.from("coin_transactions").insert({
        user_id: target.id,
        amount,
        type: amount > 0 ? "admin_mint" : "admin_deduct",
        reference: note,
      });
      newBalance = updated;
    } else {
      if (amount < 0) {
        await reply(chat_id, "Balance must be 0 or positive.");
        return true;
      }
      const delta = amount - (target.coin_balance ?? 0);
      const { error: upErr } = await admin
        .from("profiles")
        .update({ coin_balance: amount })
        .eq("id", target.id);
      if (upErr) {
        await reply(chat_id, `❌ ${upErr.message}`);
        return true;
      }
      if (delta !== 0) {
        await admin.from("coin_transactions").insert({
          user_id: target.id,
          amount: delta,
          type: delta > 0 ? "admin_mint" : "admin_deduct",
          reference: note,
        });
      }
      newBalance = amount;
    }
    await reply(
      chat_id,
      `✅ ${target.display_name ?? target.email ?? target.id} balance: <b>${newBalance}</b> OG coins`,
    );
    // DM the affected user too if they're linked
    if (target.telegram_chat_id) {
      await reply(
        target.telegram_chat_id,
        `💰 Your OG coin balance was updated by Boss.\nNew balance: <b>${newBalance}</b> OG coins.`,
      );
    }
    return true;
  }

  if (cmd === "/stats") {
    const [{ count: users }, { count: linked }, { data: coinAgg }] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("telegram_chat_id", "is", null),
      admin.from("profiles").select("coin_balance"),
    ]);
    const totalCoins = (coinAgg ?? []).reduce(
      (a: number, r: { coin_balance: number | null }) => a + (r.coin_balance ?? 0),
      0,
    );
    await reply(
      chat_id,
      `📊 <b>Stats</b>\n👥 Users: <b>${users ?? 0}</b>\n✈️ Telegram-linked: <b>${linked ?? 0}</b>\n💰 Total coins in circulation: <b>${totalCoins}</b>`,
    );
    return true;
  }

  if (cmd === "/broadcast") {
    if (!arg.trim()) {
      await reply(chat_id, "Usage: /broadcast &lt;message&gt;");
      return true;
    }
    const { data } = await admin
      .from("profiles")
      .select("telegram_chat_id")
      .not("telegram_chat_id", "is", null);
    let sent = 0;
    for (const row of (data ?? []) as { telegram_chat_id: number }[]) {
      await reply(row.telegram_chat_id, `📣 <b>OG Streamz</b>\n\n${arg}`);
      sent++;
    }
    await reply(chat_id, `✅ Broadcast sent to ${sent} users.`);
    return true;
  }

  return false;
}

async function runChatAI(
  admin: Awaited<ReturnType<typeof loadAdmin>>,
  profileId: string,
  chat_id: number,
  userText: string,
  roles: string[],
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    await reply(chat_id, "AI gateway not configured.");
    return;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, email, coin_balance")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) {
    await reply(chat_id, "Profile not found.");
    return;
  }

  const isVip = roles.includes("vip") || roles.includes("admin") || roles.includes("dev");
  const isAdminUser = roles.includes("admin") || roles.includes("dev");

  // Charge 1 coin per message — skip for admins/dev.
  if (!isAdminUser) {
    if ((profile.coin_balance ?? 0) <= 0) {
      await reply(
        chat_id,
        "💸 Out of OG coins. Top up in the app to keep chatting.",
      );
      return;
    }
    const { error: deductErr } = await admin.rpc("deduct_coins", {
      p_user: profileId,
      p_amount: 1,
      p_reference: "telegram_chat",
    });
    if (deductErr) {
      await reply(chat_id, `❌ ${deductErr.message}`);
      return;
    }
  }

  // Pull persona overrides + foul preference
  const [prefRes, siteRes, historyRes] = await Promise.all([
    admin.from("user_preferences").select("foul_mouth").eq("user_id", profileId).maybeSingle(),
    admin
      .from("site_content")
      .select("key, value")
      .in("key", ["og_persona.script", "og_persona.voice", "og_persona.dictionary"]),
    admin
      .from("og_messages")
      .select("role, content")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const personaMap = new Map<string, string>(
    (siteRes.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
  );
  const foulMouth = isVip ? (prefRes.data?.foul_mouth ?? true) : false;

  const userCtx: UserContextSummary = {
    display_name: profile.display_name,
    email: profile.email,
    coin_balance: profile.coin_balance ?? 0,
    is_admin: isAdminUser,
    is_vip: isVip,
    page_context: "telegram",
  };

  const system = buildSystemPrompt({
    mode: "og",
    foulMouth,
    bossScript: personaMap.get("og_persona.script") ?? null,
    bossVoice: personaMap.get("og_persona.voice") ?? null,
    bossDictionary: personaMap.get("og_persona.dictionary") ?? null,
    learnedInsults: [],
    language: "English",
    user: userCtx,
    songIntent: detectSongIntent(userText),
  });
  const history = ((historyRes.data ?? []) as { role: string; content: string }[])
    .reverse()
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
  const conversation = [
    { role: "system" as const, content: system },
    ...history,
    { role: "user" as const, content: userText },
  ];
  const requestReply = (extraInstruction?: string) =>
    fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        temperature: foulMouth ? 0.9 : 0.75,
        max_tokens: 1_600,
        messages: extraInstruction
          ? [...conversation, { role: "system" as const, content: extraInstruction }]
          : conversation,
      }),
    });

  // Save user message
  await admin.from("og_messages").insert({
    user_id: profileId,
    role: "user",
    content: userText,
  });

  try {
    let res = await requestReply();

    if (!res.ok) {
      if (!isAdminUser) {
        await admin.rpc("mint_coins_admin", {
          target_user_id: profileId,
          amount: 1,
          admin_notes: "telegram_chat_refund",
        });
      }
      if (res.status === 429) {
        await reply(chat_id, "⏱️ OG Bot is rate-limited, try again soon.");
      } else if (res.status === 402) {
        await reply(chat_id, "💳 AI credits exhausted — Boss needs to top up Lovable AI.");
      } else {
        await reply(chat_id, `OG Bot couldn't respond right now (HTTP ${res.status}).`);
      }
      return;
    }

    let json = (await res.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
    };
    let replyText = (json.choices?.[0]?.message?.content ?? "").trim();
    const wordCount = replyText.split(/\s+/).filter(Boolean).length;
    if (!replyText || wordCount < 18) {
      res = await requestReply(
        "Your draft answer was too short. Answer again with at least 3 substantive sentences, useful detail, and natural OG Bot personality. Do not mention this correction.",
      );
      if (res.ok) {
        json = (await res.json().catch(() => ({}))) as {
          choices?: { message?: { content?: string } }[];
        };
        const expandedReply = (json.choices?.[0]?.message?.content ?? "").trim();
        if (expandedReply) replyText = expandedReply;
      }
    }
    if (!replyText) throw new Error("OG Bot returned an empty answer. Try again.");

    await admin.from("og_messages").insert({
      user_id: profileId,
      role: "assistant",
      content: replyText,
    });

    // Telegram caps messages at ~4096 chars
    const chunks = replyText.match(/[\s\S]{1,3800}/g) ?? [replyText];
    for (const c of chunks) {
      await tg("sendMessage", {
        chat_id,
        text: c,
        disable_web_page_preview: true,
      });
    }
  } catch (err) {
    if (!isAdminUser) {
      await admin
        .rpc("mint_coins_admin", {
          target_user_id: profileId,
          amount: 1,
          admin_notes: "telegram_chat_refund",
        })
        .then(() => undefined, () => undefined);
    }
    await reply(chat_id, `❌ ${(err as Error).message}`);
  }
}

function startMatchKind(text: string | undefined): string {
  if (typeof text !== "string") return "non_text";
  const t = text.trim();
  if (/^\/start\b/i.test(t)) return "start";
  if (/^\//.test(t)) return "command";
  return "message";
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tgKey = process.env.TELEGRAM_API_KEY;
        if (!tgKey) return new Response("not_configured", { status: 500 });

        const expected = deriveSecret(tgKey);
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, expected)) return new Response("unauthorized", { status: 401 });

        const update = await request.json().catch(() => null);
        const updateId: number | undefined =
          typeof update?.update_id === "number" ? update.update_id : undefined;
        const msg = update?.message ?? update?.edited_message;
        const chat_id: number | undefined = msg?.chat?.id;
        const text: string | undefined = msg?.text;
        if (!chat_id) return Response.json({ ok: true, ignored: true });

        const admin = await loadAdmin();

        // ---- Idempotency: claim this update_id atomically. Telegram retries
        // on slow handlers, so without this a single /start could link twice
        // or a chat message could be charged twice.
        if (typeof updateId === "number") {
          const { error: dupErr } = await admin
            .from("telegram_processed_updates")
            .insert({ update_id: updateId, chat_id, kind: startMatchKind(text) });
          if (dupErr) {
            const code = (dupErr as { code?: string }).code;
            if (code === "23505") {
              return Response.json({ ok: true, duplicate: true, update_id: updateId });
            }
            console.error("[telegram] processed_updates insert failed", dupErr);
          }
        }

        try {
          return await handleTelegramUpdate(admin, chat_id, text, msg);
        } catch (err) {
          console.error("[telegram] handler error", err);
          await reply(
            chat_id,
            "⚠️ OG Bot hit an internal error handling that update. Boss has been notified.",
          ).catch(() => undefined);
          return Response.json(
            { ok: false, error: (err as Error)?.message ?? "handler_error" },
            { status: 200 },
          );
        }
      },
    },
  },
});

async function handleTelegramUpdate(
  admin: Awaited<ReturnType<typeof loadAdmin>>,
  chat_id: number,
  text: string | undefined,
  msg: {
    chat?: { id?: number; type?: string };
    from?: { id?: number; username?: string; first_name?: string };
  },
): Promise<Response> {

        // Look up linked profile by chat_id FIRST so already-linked users
        // get full chat + admin commands without needing /start.
        const { data: linkedProfile } = await admin
          .from("profiles")
          .select("id")
          .eq("telegram_chat_id", chat_id)
          .maybeSingle();

        const startMatch =
          typeof text === "string" ? text.match(/^\/start\s+(\S+)/i) : null;

        // ===== Linked user path =====
        if (linkedProfile && typeof text === "string") {
          let trimmed = text.trim();
          const { admin: isBoss, roles } = await isAdmin(admin, linkedProfile.id);
          const keyboard = isBoss ? BOSS_KEYBOARD : USER_KEYBOARD;

          // Map emoji-keyboard button taps → slash commands
          const buttonMap: Record<string, string> = {
            "💰 Balance": "/balance",
            "🎧 Library": "/library",
            "🛒 Buy Coins": "/buy",
            "👤 My Profile": "/me",
            "❓ Help": "/help",
            "🟢 Online Now": "/online",
            "🕒 Last Seen": "/lastseen",
            "📊 Stats": "/stats",
            "👥 Users": "/users",
          };
          if (buttonMap[trimmed]) trimmed = buttonMap[trimmed];

          if (/^\/help\b/i.test(trimmed) || /^\/menu\b/i.test(trimmed)) {
            await reply(chat_id, isBoss ? HELP_ADMIN : HELP_USER, {
              reply_markup: keyboard,
            });
            return Response.json({ ok: true, help: true });
          }
          if (/^\/balance\b/i.test(trimmed)) {
            const { data: p } = await admin
              .from("profiles")
              .select("coin_balance")
              .eq("id", linkedProfile.id)
              .maybeSingle();
            await reply(chat_id, `💰 Balance: <b>${p?.coin_balance ?? 0}</b> OG coins`, {
              reply_markup: keyboard,
            });
            return Response.json({ ok: true, balance: true });
          }
          if (/^\/library\b/i.test(trimmed)) {
            await reply(chat_id, "🎧 <b>Your library</b>", {
              reply_markup: {
                inline_keyboard: [[{ text: "Open Library", url: "https://og-196.lovable.app/library" }]],
              },
            });
            return Response.json({ ok: true, library: true });
          }
          if (/^\/buy\b/i.test(trimmed)) {
            await reply(chat_id, "🛒 <b>Top up OG coins</b>", {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Open Store", url: "https://og-196.lovable.app/buy-coins" }],
                ],
              },
            });
            return Response.json({ ok: true, buy: true });
          }
          if (/^\/me\b/i.test(trimmed)) {
            const { data: p } = await admin
              .from("profiles")
              .select(PROFILE_COLS)
              .eq("id", linkedProfile.id)
              .maybeSingle();
            await reply(chat_id, p ? fmtProfile(p as AdminProfile) : "Profile not found.", {
              reply_markup: keyboard,
            });
            return Response.json({ ok: true, me: true });
          }
          if (/^\/start\b/i.test(trimmed)) {
            await reply(chat_id, `✅ Already linked. Tap a button below or type /help.`, {
              reply_markup: keyboard,
            });
            return Response.json({ ok: true, already_linked: true });
          }

          // Admin commands
          if (isBoss && trimmed.startsWith("/")) {
            const handled = await runAdminCommand(admin, chat_id, trimmed);
            if (handled) return Response.json({ ok: true, admin_cmd: true });
          }

          // Reject unknown slash commands for non-admins
          if (trimmed.startsWith("/")) {
            await reply(chat_id, "Unknown command. Type /help.", { reply_markup: keyboard });
            return Response.json({ ok: true, unknown_cmd: true });
          }


          // Otherwise route to AI chat
          await runChatAI(admin, linkedProfile.id, chat_id, text, roles);
          return Response.json({ ok: true, chatted: true });
        }

        // ===== Not linked yet =====
        // Boss bootstrap runs on ANY message (not just /start) so the boss
        // gets auto-linked even if they just say "hi" from a known username.
        {
          const bootstrapped = await maybeBootstrapBossTelegram(admin, chat_id, msg);
          if (bootstrapped) return Response.json({ ok: true, boss_bootstrap: true });
        }

        if (typeof text === "string" && /^\/help\b/i.test(text.trim())) {
          await reply(
            chat_id,
            "🛠️ <b>OG Bot is online.</b>\n\nTo link your account, open OG Streamz → Settings → Connect Telegram, then tap your personal Telegram link.\n\nAfter linking, you can chat with me (same brain as the in-app messenger) and admins get full user/coin management commands.",
          );
          return Response.json({ ok: true, help: true });
        }

        if (!startMatch) {
          if (typeof text === "string" && /^\/start\b/i.test(text.trim())) {
            await reply(
              chat_id,
              "🔥 <b>OG Bot is alive.</b>\n\nYou opened me without your private link token, so I can't connect this Telegram chat to your OG profile yet.\n\nGo to OG Streamz → Settings → <b>Connect Telegram</b>, tap your personal link, then hit Start again.",
            );
            return Response.json({ ok: true, missing_token: true });
          }
          await reply(
            chat_id,
            "👋 <b>OG Bot is online.</b>\n\nLink your OG profile from Settings → Connect Telegram to unlock the full assistant here.",
          );
          return Response.json({ ok: true, unlinked_reply: true });
        }

        const rawToken = startMatch[1].toLowerCase();
        const tokenMatch = rawToken.match(TOKEN_RE);
        if (!tokenMatch) {
          await reply(
            chat_id,
            "⚠️ That Telegram connect link is invalid. Please generate/open a fresh link from OG Streamz → Settings → Connect Telegram.",
          );
          return Response.json({ ok: true, rejected: "bad_token_format" });
        }
        const token = tokenMatch[1];

        let profileId: string | null = null;

        if (token.startsWith("t_")) {
          const { data: byToken } = await admin
            .from("profiles")
            .select("id")
            .eq("telegram_link_token", token)
            .limit(2);
          if (!byToken || byToken.length !== 1) {
            await reply(
              chat_id,
              "⚠️ That Telegram connect link has expired or was already used. Please generate/open a fresh link from OG Streamz → Settings.",
            );
            return Response.json({ ok: true, rejected: "no_or_ambiguous_match" });
          }
          profileId = byToken[0].id as string;
        } else {
          const uuidPrefix = tokenToUuidPrefix(token);
          const { min, max } = tokenToUuidRange(token);
          const { data: candidates } = await admin
            .from("profiles")
            .select("id")
            .gte("id", min)
            .lte("id", max)
            .limit(2);
          if (!candidates || candidates.length !== 1) {
            await reply(
              chat_id,
              "⚠️ I couldn't match that link to an OG profile. Please open the Telegram button directly from OG Streamz Settings.",
            );
            return Response.json({ ok: true, rejected: "no_or_ambiguous_match" });
          }
          const pid = candidates[0].id as string;
          const reconstructed = pid.replace(/-/g, "").slice(0, 24).toLowerCase();
          if (reconstructed !== token) {
            await reply(
              chat_id,
              "⚠️ This connect token doesn't match your OG profile. Please open a fresh Telegram link from Settings.",
            );
            return Response.json({ ok: true, rejected: "token_mismatch" });
          }
          profileId = pid;
        }

        // Verify chat reachable
        const chatVerified = await verifyTelegramChat(chat_id);

        if (!chatVerified) {
          await reply(
            chat_id,
            "⚠️ I received your Start request, but Telegram chat verification failed. Please tap Start again in a moment.",
          );
          return Response.json(
            { ok: true, rejected: "chat_verification_failed" },
            { status: 200 },
          );
        }

        const { error: linkError } = await admin
          .from("profiles")
          .update({
            telegram_chat_id: chat_id,
            telegram_username: msg?.from?.username ?? null,
            telegram_linked_at: new Date().toISOString(),
            telegram_link_token: null,
          })
          .eq("id", profileId);

        if (linkError) {
          await reply(chat_id, `❌ Telegram link failed: ${linkError.message}`);
          return Response.json({ ok: true, rejected: "profile_update_failed" });
        }

        await admin.from("telegram_sign_in_events").insert({
          user_id: profileId,
          chat_id,
          telegram_username: msg?.from?.username ?? null,
          telegram_first_name: (msg?.from?.first_name as string | undefined) ?? null,
          event_kind: "link",
          source: "webhook_start",
        }).then(() => undefined, () => undefined);

        const { data: profile } = await admin
          .from("profiles")
          .select("display_name, email, coin_balance")
          .eq("id", profileId)
          .maybeSingle();

        const { admin: isBoss } = await isAdmin(admin, profileId);

        const tgFirst = (msg?.from?.first_name as string | undefined)?.trim();
        const name =
          tgFirst ||
          profile?.display_name ||
          (profile?.email ? profile.email.split("@")[0] : null) ||
          "legend";
        const balance = profile?.coin_balance ?? 0;

        const greeting =
          `✅ <b>Connected!</b> OG Bot is now linked to your account.\n\n` +
          `🔥 Yo <b>${name}</b> — link verified. OG Bot in your pocket now.\n\n` +
          `💰 Balance: <b>${balance}</b> OG coins\n` +
          `🎧 Just chat — same brain as the in-app messenger.\n` +
          (isBoss
            ? `👑 Boss mode unlocked — type /help for admin commands.\n\n`
            : `Type /help for commands.\n\n`) +
          `Now go make some noise. 🎤`;

        await reply(chat_id, greeting, {
          reply_markup: isBoss ? BOSS_KEYBOARD : USER_KEYBOARD,
        });

        await admin
          .from("og_messages")
          .insert({
            user_id: profileId,
            role: "assistant",
            content: `✅ Telegram linked. I'll DM you at @${msg?.from?.username ?? "your handle"} from now on.`,
          })
          .then(() => undefined, () => undefined);

  return Response.json({ ok: true, linked: true, verified: true });
}

