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

export type TvPlaylist = {
  fetchedAt: string;
  total: number;
  channels: TvChannel[];
  truncated: boolean;
};

const MAX_ITEMS = 6000;

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
    const url =
      `${TV_HUB_HOST}/get.php?username=${encodeURIComponent(data.username)}` +
      `&password=${encodeURIComponent(data.password)}&type=m3u_plus&output=ts`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", Accept: "*/*" },
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      throw new Error("Could not reach the TV provider. Try again in a moment.");
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error("Those details were rejected by the TV provider.");
    }
    if (!response.ok) {
      throw new Error(`The TV provider responded with an error (${response.status}).`);
    }

    const text = await response.text();
    if (!text.includes("#EXTM3U")) {
      throw new Error("Sign-in failed — check your username and password.");
    }

    const parsed = parseM3u(text);
    if (parsed.channels.length === 0) {
      throw new Error("This account has no channels available right now.");
    }

    return {
      fetchedAt: new Date().toISOString(),
      total: parsed.total,
      channels: parsed.channels,
      truncated: parsed.truncated,
    };
  });
