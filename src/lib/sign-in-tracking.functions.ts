import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_TG = "https://connector-gateway.lovable.dev/telegram";

// ---------- helpers (server-only) ----------

function parseUserAgent(ua: string): {
  browser: string;
  os: string;
  device_type: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
} {
  const s = ua || "";
  let browser = "Unknown";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(s)) browser = "Opera";
  else if (/Chrome\//i.test(s) && !/Edg\//i.test(s)) browser = "Chrome";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Safari\//i.test(s) && !/Chrome\//i.test(s)) browser = "Safari";
  else if (/bot|crawler|spider/i.test(s)) browser = "Bot";

  let os = "Unknown";
  if (/Windows NT/i.test(s)) os = "Windows";
  else if (/Mac OS X/i.test(s) && !/Mobile|iPhone|iPad/i.test(s)) os = "macOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(s)) os = "iOS";
  else if (/Linux/i.test(s)) os = "Linux";

  let device_type: "mobile" | "tablet" | "desktop" | "bot" | "unknown" = "desktop";
  if (/bot|crawler|spider/i.test(s)) device_type = "bot";
  else if (/iPad|Tablet/i.test(s)) device_type = "tablet";
  else if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(s)) device_type = "mobile";
  else if (!s) device_type = "unknown";

  return { browser, os, device_type };
}

function clientIp(): string | null {
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf;
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xr = getRequestHeader("x-real-ip");
  if (xr) return xr;
  return null;
}

function subnetOf(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":"); // /64-ish for IPv6
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`; // /24
  return ip;
}

type GeoInfo = {
  country: string | null;
  region: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
};

async function lookupGeo(ip: string | null): Promise<GeoInfo> {
  const empty: GeoInfo = { country: null, region: null, city: null, lat: null, lng: null };
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return empty;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1800);
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "ogstreamz-signin-tracker" },
    });
    clearTimeout(t);
    if (!res.ok) return empty;
    const j: Record<string, unknown> = await res.json();
    return {
      country: (j.country_name as string) || (j.country as string) || null,
      region: (j.region as string) || null,
      city: (j.city as string) || null,
      lat: typeof j.latitude === "number" ? (j.latitude as number) : null,
      lng: typeof j.longitude === "number" ? (j.longitude as number) : null,
    };
  } catch {
    return empty;
  }
}

async function sendTelegramDirect(
  chatId: number,
  text: string,
  targetUserId?: string,
): Promise<{ ok: boolean; error?: string; stale?: boolean }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const tgKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey || !tgKey) return { ok: false, error: "missing_keys" };
  try {
    const res = await fetch(`${GATEWAY_TG}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": tgKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (res.ok) return { ok: true };
    const j = (await res.json().catch(() => null)) as { description?: string } | null;
    const desc = j?.description ?? `http_${res.status}`;
    // Telegram says the chat is gone / bot was kicked / token swapped —
    // unlink so we stop spamming failures and the user can re-/start.
    const stale =
      /chat not found|bot was blocked|user is deactivated|chat was deleted|bot was kicked/i.test(
        desc,
      );
    if (stale && targetUserId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("profiles")
          .update({
            telegram_chat_id: null,
            telegram_linked_at: null,
            telegram_link_token: null,
          })
          .eq("id", targetUserId);
      } catch {
        /* ignore */
      }
    }
    return { ok: false, error: desc, stale };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------- main: recordSignIn ----------

export const recordSignIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { referrer?: string | null; landingPath?: string | null; gpsLat?: number | null; gpsLng?: number | null }) => ({
    referrer: typeof d?.referrer === "string" ? d.referrer.slice(0, 500) : null,
    landingPath: typeof d?.landingPath === "string" ? d.landingPath.slice(0, 500) : null,
    gpsLat: typeof d?.gpsLat === "number" ? d.gpsLat : null,
    gpsLng: typeof d?.gpsLng === "number" ? d.gpsLng : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ua = getRequestHeader("user-agent") || "";
    const { browser, os, device_type } = parseUserAgent(ua);
    const ip = clientIp();
    const sub = subnetOf(ip);
    const uaHash = createHash("sha256")
      .update(`${browser}|${os}|${device_type}|${sub ?? ""}`)
      .digest("hex")
      .slice(0, 32);

    // Profile lookup (existing geo + signup detection)
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email, last_country, sign_in_count, created_at")
      .eq("id", context.userId)
      .maybeSingle();

    const isSignup = !prof?.sign_in_count || prof.sign_in_count === 0;

    // Geo lookup (with timeout, non-blocking on failure)
    const geo = await lookupGeo(ip);

    // Device upsert + new-device detection
    let isNewDevice = false;
    const { data: existingDev } = await supabaseAdmin
      .from("user_devices")
      .select("id, sign_in_count")
      .eq("user_id", context.userId)
      .eq("ua_hash", uaHash)
      .maybeSingle();

    if (existingDev) {
      await supabaseAdmin
        .from("user_devices")
        .update({
          sign_in_count: (existingDev.sign_in_count ?? 0) + 1,
          last_seen_at: new Date().toISOString(),
          last_country: geo.country,
        })
        .eq("id", existingDev.id);
    } else {
      isNewDevice = true;
      await supabaseAdmin.from("user_devices").insert({
        user_id: context.userId,
        ua_hash: uaHash,
        ip_subnet: sub,
        browser,
        os,
        device_type,
        first_country: geo.country,
        last_country: geo.country,
      });
    }

    const isNewCountry =
      !!geo.country && !!prof?.last_country && prof.last_country !== geo.country;

    // Insert event
    await supabaseAdmin.from("sign_in_events").insert({
      user_id: context.userId,
      ip,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      lat: geo.lat,
      lng: geo.lng,
      gps_lat: data.gpsLat,
      gps_lng: data.gpsLng,
      ua_raw: ua.slice(0, 1000),
      browser,
      os,
      device_type,
      referrer: data.referrer,
      landing_path: data.landingPath,
      is_new_device: isNewDevice,
      is_new_country: isNewCountry,
      is_signup: isSignup,
    });

    // Profile denorm update
    await supabaseAdmin
      .from("profiles")
      .update({
        last_sign_in_at: new Date().toISOString(),
        last_ip: ip,
        last_country: geo.country,
        last_city: geo.city,
        last_device: `${browser} on ${os}`,
        sign_in_count: (prof?.sign_in_count ?? 0) + 1,
      })
      .eq("id", context.userId);

    // Boss notifications + Sheets sync (fire and forget)
    void notifyBossesAndSync({
      userId: context.userId,
      displayName: prof?.display_name ?? prof?.email ?? "user",
      email: prof?.email ?? null,
      isSignup,
      isNewDevice,
      isNewCountry,
      country: geo.country,
      city: geo.city,
      browser,
      os,
      referrer: data.referrer,
    }).catch(() => {});

    return {
      ok: true as const,
      isSignup,
      isNewDevice,
      isNewCountry,
      geo: { country: geo.country, city: geo.city },
      device: { browser, os, device_type },
    };
  });

async function notifyBossesAndSync(ev: {
  userId: string;
  displayName: string;
  email: string | null;
  isSignup: boolean;
  isNewDevice: boolean;
  isNewCountry: boolean;
  country: string | null;
  city: string | null;
  browser: string;
  os: string;
  referrer: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // All admins/bosses with a Telegram chat id
  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "boss"]);
  const adminIds = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
  if (adminIds.length === 0) return;

  const { data: prefsRows } = await supabaseAdmin
    .from("boss_notification_prefs")
    .select("*")
    .in("user_id", adminIds);
  const prefsMap = new Map(
    (prefsRows ?? []).map((p) => [p.user_id, p]),
  );

  const { data: bossProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, telegram_chat_id")
    .in("id", adminIds);
  const chatMap = new Map(
    (bossProfiles ?? []).map((b) => [b.id, b.telegram_chat_id as number | null]),
  );

  const flags: string[] = [];
  if (ev.isSignup) flags.push("🆕 SIGNUP");
  if (ev.isNewDevice) flags.push("📱 new device");
  if (ev.isNewCountry) flags.push("🌍 new country");

  const text =
    `<b>${flags.length ? flags.join(" · ") : "🔐 Sign-in"}</b>\n` +
    `${escapeHtml(ev.displayName)}${ev.email ? ` (<code>${escapeHtml(ev.email)}</code>)` : ""}\n` +
    `📍 ${ev.country ?? "Unknown"}${ev.city ? ` · ${ev.city}` : ""}\n` +
    `💻 ${ev.browser} on ${ev.os}\n` +
    (ev.referrer ? `↗️ ref: ${escapeHtml(ev.referrer).slice(0, 120)}` : "");

  for (const bossId of adminIds) {
    const prefs = prefsMap.get(bossId);
    // default: notify on signup + new device + new country
    const notify = prefs
      ? (ev.isSignup && prefs.notify_on_signup) ||
        (prefs.notify_every_signin && !ev.isSignup) ||
        (ev.isNewDevice && prefs.notify_new_device) ||
        (ev.isNewCountry && prefs.notify_new_country)
      : ev.isSignup || ev.isNewDevice || ev.isNewCountry;

    if (!notify) continue;
    const chatId = chatMap.get(bossId);
    if (!chatId) continue;

    // Queue + try send
    const { data: q } = await supabaseAdmin
      .from("telegram_dm_queue")
      .insert({
        target_user_id: bossId,
        body: text,
        status: "pending",
        attempts: 1,
      })
      .select("id")
      .single();
    const ok = await sendTelegramDirect(chatId, text);
    if (q?.id) {
      await supabaseAdmin
        .from("telegram_dm_queue")
        .update({
          status: ok ? "sent" : "failed",
          sent_at: ok ? new Date().toISOString() : null,
          last_error: ok ? null : "send_failed",
        })
        .eq("id", q.id);
    }
  }

  // Sheets sync — single sheet, one row per user, updated in place
  void syncUserToSheet(ev.userId).catch(() => {});
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// ---------- Sheets upsert (single user) ----------

async function syncUserToSheet(userId: string): Promise<void> {
  const { upsertProfileRowToSheet } = await import("@/lib/sheets-sync.server");
  await upsertProfileRowToSheet(userId);
}

// ---------- Boss notification preferences ----------

export const getBossNotifPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const { data: roleOk } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: bossOk } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "boss",
    });
    if (!roleOk && !bossOk) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let { data } = await supabaseAdmin
      .from("boss_notification_prefs")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) {
      const ins = await supabaseAdmin
        .from("boss_notification_prefs")
        .insert({ user_id: context.userId })
        .select("*")
        .single();
      data = ins.data;
    }
    return data;
  });

export const updateBossNotifPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<{
    notify_on_signup: boolean;
    notify_every_signin: boolean;
    notify_new_device: boolean;
    notify_new_country: boolean;
    notify_suspicious: boolean;
    sheets_sync_enabled: boolean;
    quiet_hours_start: number | null;
    quiet_hours_end: number | null;
  }>) => d ?? {})
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: roleOk } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: bossOk } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "boss",
    });
    if (!roleOk && !bossOk) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("boss_notification_prefs")
      .upsert({ user_id: context.userId, ...data, updated_at: new Date().toISOString() })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Admin reads ----------

export const getUserSignInHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; limit?: number }) => ({
    userId: d.userId,
    limit: Math.min(Math.max(d.limit ?? 20, 1), 100),
  }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: ok } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: bossOk } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "boss",
    });
    if (!ok && !bossOk) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: events }, { data: devices }] = await Promise.all([
      supabaseAdmin
        .from("sign_in_events")
        .select("*")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(data.limit),
      supabaseAdmin
        .from("user_devices")
        .select("*")
        .eq("user_id", data.userId)
        .order("last_seen_at", { ascending: false }),
    ]);
    return { events: events ?? [], devices: devices ?? [] };
  });

export const listUsersPro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string }) => ({ search: (d?.search ?? "").trim().slice(0, 100) }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: ok } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: bossOk } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "boss",
    });
    if (!ok && !bossOk) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("profiles")
      .select(
        "id, email, display_name, coin_balance, created_at, telegram_chat_id, telegram_linked_at, last_sign_in_at, last_ip, last_country, last_city, last_device, sign_in_count, gps_consent",
      )
      .order("last_sign_in_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (data.search) {
      q = q.or(
        `email.ilike.%${data.search}%,display_name.ilike.%${data.search}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const sendTestBossNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const { data: ok } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: bossOk } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "boss",
    });
    if (!ok && !bossOk) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("telegram_chat_id, display_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof?.telegram_chat_id) {
      return { ok: false as const, reason: "Boss has no Telegram linked" };
    }
    const sent = await sendTelegramDirect(
      prof.telegram_chat_id as number,
      `🧪 <b>Test notification</b>\nBoss console is wired correctly, ${escapeHtml(prof.display_name ?? "boss")}.`,
    );
    return { ok: sent };
  });
