import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * TV HUB provider sign-in.
 *
 * The provider host is fixed. The user only supplies username + password, which
 * are substituted into the provider's playlist URL. Nothing is stored: the
 * playlist is fetched, parsed in memory and returned to the caller for the
 * duration of the session only. No content is hosted or proxied by this app.
 */

export const TV_HUB_HOST = "http://xiu96ctyh6-system.xyz";

export type TvSection = "tv" | "movies" | "series";

export type TvChannel = {
  id: string;
  title: string;
  group: string;
  logo: string | null;
  url: string;
  section: TvSection;
};

export type TvAccount = {
  username: string | null;
  status: string | null;
  /** ISO date string, or null when the provider does not report one. */
  expiresAt: string | null;
  maxConnections: string | null;
  activeConnections: string | null;
};

export type TvPlaylist = {
  fetchedAt: string;
  total: number;
  channels: TvChannel[];
  truncated: boolean;
  account: TvAccount | null;
};

const MAX_ITEMS = 60000;

function classify(group: string, url: string): TvSection {
  const g = group.toLowerCase();
  const u = url.toLowerCase();
  if (u.includes("/series/") || g.includes("series") || g.includes("tv show")) return "series";
  if (u.includes("/movie/") || g.includes("movie") || g.includes("vod") || g.includes("film")) return "movies";
  return "tv";
}

function attr(line: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(line);
  return match?.[1]?.trim() || null;
}

export function parseM3u(text: string): { channels: TvChannel[]; total: number; truncated: boolean } {
  const lines = text.split(/\r?\n/);
  const channels: TvChannel[] = [];
  let total = 0;
  let pending: { title: string; group: string; logo: string | null } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const commaIndex = line.indexOf(",");
      const title = (commaIndex >= 0 ? line.slice(commaIndex + 1) : "").trim();
      pending = {
        title: title || attr(line, "tvg-name") || "Untitled",
        group: attr(line, "group-title") || "Uncategorised",
        logo: attr(line, "tvg-logo"),
      };
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!pending) continue;
    total += 1;
    if (channels.length < MAX_ITEMS) {
      channels.push({
        id: `${channels.length}-${line.slice(-40)}`,
        title: pending.title,
        group: pending.group,
        logo: pending.logo,
        url: line,
        section: classify(pending.group, line),
      });
    }
    pending = null;
  }

  return { channels, total, truncated: total > channels.length };
}

/** The provider answers on both the bare host and the explicit :80 host — try both. */
export const TV_HUB_HOSTS = [`${TV_HUB_HOST}:80`, TV_HUB_HOST];

/** Xtream player_api.php reports subscription status and expiry for the account. */
async function fetchAccountInfo(username: string, password: string): Promise<TvAccount | null> {
  const query =
    `player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  for (const host of TV_HUB_HOSTS) {
    try {
      const response = await fetch(`${host}/${query}`, {
        headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", Accept: "*/*" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) continue;
      const json = (await response.json()) as { user_info?: Record<string, unknown> };
      const info = json?.user_info;
      if (!info) continue;
      const rawExp = info["exp_date"];
      const seconds = typeof rawExp === "string" ? Number(rawExp) : typeof rawExp === "number" ? rawExp : NaN;
      const str = (value: unknown) =>
        value === null || value === undefined || value === "" ? null : String(value);
      return {
        username: str(info["username"]) ?? username,
        status: str(info["status"]),
        expiresAt: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null,
        maxConnections: str(info["max_connections"]),
        activeConnections: str(info["active_cons"]),
      };
    } catch {
      continue;
    }
  }
  return null;
}


export const loadTvHubPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        username: z.string().trim().min(1).max(128),
        password: z.string().min(1).max(256),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<TvPlaylist> => {
    const query =
      `get.php?username=${encodeURIComponent(data.username)}` +
      `&password=${encodeURIComponent(data.password)}&type=m3u_plus&output=ts`;

    let text: string | null = null;
    let rejected = false;
    let lastStatus: number | null = null;
    let reachable = false;

    for (const host of TV_HUB_HOSTS) {
      let response: Response;
      try {
        response = await fetch(`${host}/${query}`, {
          headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", Accept: "*/*" },
          signal: AbortSignal.timeout(45_000),
        });
      } catch {
        continue;
      }
      reachable = true;
      lastStatus = response.status;
      if (response.status === 401 || response.status === 403) {
        rejected = true;
        continue;
      }
      if (!response.ok) continue;
      const body = await response.text();
      if (body.includes("#EXTM3U")) {
        text = body;
        break;
      }
      rejected = true;
    }

    if (!reachable) {
      throw new Error("Could not reach the TV provider. Try again in a moment.");
    }
    if (!text) {
      if (rejected) throw new Error("Sign-in failed — check your username and password.");
      throw new Error(`The TV provider responded with an error (${lastStatus ?? "unknown"}).`);
    }

    const parsed = parseM3u(text);
    if (parsed.channels.length === 0) {
      throw new Error("This account has no channels available right now.");
    }

    const account = await fetchAccountInfo(data.username, data.password);

    return {
      fetchedAt: new Date().toISOString(),
      total: parsed.total,
      channels: parsed.channels,
      truncated: parsed.truncated,
      account,
    };
  });

export type TvStreamSource = { url: string; kind: "hls" | "ts" | "file" };

/**
 * Turn a provider URL into a same-origin, signed, short-lived relay link.
 * Browsers cannot play the provider's plain-HTTP CORS-less streams directly.
 * Nothing is stored or hosted: bytes stream through and are discarded.
 */
export const prepareTvStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().url().max(2048) }).parse(data))
  .handler(async ({ data }): Promise<TvStreamSource> => {
    const target = new URL(data.url);
    if (!TV_HUB_HOSTS.some((host) => new URL(host).hostname === target.hostname)) {
      throw new Error("That stream is not from the TV HUB provider.");
    }

    const { signStreamUrl } = await import("./tv-stream.server");
    const raw = target.toString();
    const isLiveTs = /\.ts$/i.test(target.pathname);
    const isFile = /\.(mp4|mkv|avi|mov|m4v)$/i.test(target.pathname);

    if (isLiveTs) {
      // Most Xtream servers also expose an HLS variant — prefer it when it answers.
      const hlsUrl = raw.replace(/\.ts$/i, ".m3u8");
      try {
        const probe = await fetch(hlsUrl, {
          headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", Accept: "*/*" },
          signal: AbortSignal.timeout(12_000),
        });
        const body = probe.ok ? await probe.text() : "";
        if (probe.ok && body.includes("#EXTM3U")) {
          return { url: signStreamUrl(hlsUrl), kind: "hls" };
        }
      } catch {
        /* fall through to raw transport stream */
      }
      return { url: signStreamUrl(raw), kind: "ts" };
    }

    if (/\.m3u8(\?|$)/i.test(raw)) return { url: signStreamUrl(raw), kind: "hls" };
    return { url: signStreamUrl(raw), kind: isFile ? "file" : "ts" };
  });
