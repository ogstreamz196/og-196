import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * TV HUB provider sign-in and shared catalogue reads.
 *
 * The provider host is fixed and the user only supplies username + password.
 * Nothing is hosted or proxied permanently: the catalogue stores titles and
 * credential-free link templates only, and each viewer's own credentials are
 * substituted at playback time.
 */

export const TV_HUB_HOST = "http://xiu96ctyh6-system.xyz";
/** The provider answers on both the bare host and the explicit :80 host — try both. */
export const TV_HUB_HOSTS = [`${TV_HUB_HOST}:80`, TV_HUB_HOST];

export type TvSection = "tv" | "movies" | "series";

export type TvChannel = {
  id: string;
  title: string;
  group: string;
  logo: string | null;
  /** Credential-free template; the player substitutes the viewer's details. */
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

export type TvCatalogStatus = {
  status: "idle" | "running" | "ready" | "error";
  total: number;
  refreshedAt: string | null;
  error: string | null;
};

export type TvCategory = { name: string; count: number };

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
      const auth = info["auth"];
      if (auth !== undefined && String(auth) === "0") return null;
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

async function readStatus(): Promise<TvCatalogStatus> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tv_catalog_meta")
    .select("status, total, refreshed_at, error")
    .eq("id", 1)
    .maybeSingle();
  return {
    status: ((data?.status as TvCatalogStatus["status"]) ?? "idle"),
    total: data?.total ?? 0,
    refreshedAt: (data?.refreshed_at as string | null) ?? null,
    error: (data?.error as string | null) ?? null,
  };
}

/** Sign in: validate the account with the provider, then report catalogue state. */
export const signInTvHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        username: z.string().trim().min(1).max(128),
        password: z.string().min(1).max(256),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ account: TvAccount; catalog: TvCatalogStatus }> => {
    const account = await fetchAccountInfo(data.username, data.password);
    if (!account) throw new Error("Sign-in failed — check your username and password.");
    return { account, catalog: await readStatus() };
  });

export const getTvCatalogStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<TvCatalogStatus> => readStatus());

/** Cached category list for a section — fast for every user, no provider hit. */
export const getTvCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ section: z.enum(["tv", "movies", "series"]) }).parse(data))
  .handler(async ({ data, context }): Promise<TvCategory[]> => {
    const { data: rows, error } = await context.supabase.rpc("tv_categories", { _section: data.section });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Array<{ category: string; item_count: number }>).map((row) => ({
      name: row.category,
      count: row.item_count,
    }));
  });

/** Cached, paged items for a category, or a master search across the section. */
export const getTvItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        section: z.enum(["tv", "movies", "series"]),
        category: z.string().max(256).nullable().optional(),
        search: z.string().max(128).nullable().optional(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).max(500_000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<TvChannel[]> => {
    const { data: rows, error } = await context.supabase.rpc("tv_items", {
      _section: data.section,
      _category: data.category ?? null,
      _search: data.search ?? null,
      _limit: data.limit ?? 200,
      _offset: data.offset ?? 0,
    });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Array<{
      id: number;
      title: string;
      category: string;
      logo: string | null;
      url_template: string;
    }>).map((row) => ({
      id: String(row.id),
      title: row.title,
      group: row.category,
      logo: row.logo,
      url: row.url_template,
      section: data.section,
    }));
  });

/**
 * Rebuild the shared catalogue from the provider playlist. Long running: the
 * caller fires it and polls getTvCatalogStatus for progress.
 */
export const refreshTvCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        username: z.string().trim().min(1).max(128),
        password: z.string().min(1).max(256),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ started: boolean; total?: number; reason?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: meta } = await supabaseAdmin
      .from("tv_catalog_meta")
      .select("status, started_at")
      .eq("id", 1)
      .maybeSingle();
    const startedAt = meta?.started_at ? new Date(meta.started_at as string).getTime() : 0;
    const stale = Date.now() - startedAt > 20 * 60 * 1000;
    if (meta?.status === "running" && !stale) return { started: false, reason: "already_running" };

    const generation = crypto.randomUUID();
    await supabaseAdmin
      .from("tv_catalog_meta")
      .update({ status: "running", error: null, started_at: new Date().toISOString() })
      .eq("id", 1);

    const { syncTvCatalog } = await import("./tv-catalog.server");
    try {
      const total = await syncTvCatalog(data.username, data.password, generation);
      return { started: true, total };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Refresh failed.";
      await supabaseAdmin.from("tv_catalog_meta").update({ status: "error", error: message }).eq("id", 1);
      await supabaseAdmin.from("tv_catalog_items").delete().eq("generation", generation);
      throw new Error(message);
    }
  });

export type TvStreamKind = "hls" | "ts" | "file";
export type TvStreamSource = {
  url: string;
  kind: TvStreamKind;
  /** Alternative relay links the player can fall back to when the first fails. */
  fallbacks: Array<{ url: string; kind: TvStreamKind }>;
};

const PROBE_HEADERS = { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", Accept: "*/*" } as const;

/**
 * Inspect the first bytes of a stream so we pick the right player engine even
 * when the URL has no file extension (common on Xtream live links).
 */
async function sniffKind(url: string): Promise<TvStreamKind | null> {
  try {
    const response = await fetch(url, {
      headers: { ...PROBE_HEADERS, Range: "bytes=0-2047" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok && response.status !== 206) return null;

    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type.includes("mpegurl")) return "hls";
    if (type.includes("mp2t") || type.includes("video/mp2t")) return "ts";
    if (type.includes("mp4") || type.includes("matroska") || type.includes("webm")) return "file";

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.length === 0) return null;
    const head = new TextDecoder().decode(buffer.slice(0, 64));
    if (head.includes("#EXTM3U")) return "hls";
    // ISO base media (mp4/mov): "ftyp" at offset 4
    if (head.slice(4, 8) === "ftyp" || head.slice(4, 8) === "styp") return "file";
    // Matroska / WebM EBML header
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "file";
    // MPEG-TS sync byte every 188 bytes
    if (buffer[0] === 0x47 && (buffer[188] === 0x47 || buffer.length < 189)) return "ts";
    return null;
  } catch {
    return null;
  }
}

/**
 * Turn a catalogue link template into a same-origin, signed, short-lived relay
 * link using the viewer's own credentials. Browsers cannot play the provider's
 * plain-HTTP CORS-less streams directly. Nothing is stored: bytes stream
 * through and are discarded.
 */
export const prepareTvStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        url: z.string().max(2048),
        username: z.string().trim().min(1).max(128),
        password: z.string().min(1).max(256),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<TvStreamSource> => {
    const { applyCredentials } = await import("./tv-catalog.server");
    const resolved = applyCredentials(data.url, data.username, data.password);

    let target: URL;
    try {
      target = new URL(resolved);
    } catch {
      throw new Error("That stream link is not valid.");
    }
    if (!TV_HUB_HOSTS.some((host) => new URL(host).hostname === target.hostname)) {
      throw new Error("That stream is not from the TV HUB provider.");
    }

    const { signStreamUrl } = await import("./tv-stream.server");
    const raw = target.toString();
    const path = target.pathname;

    const hasTs = /\.ts$/i.test(path);
    const hasM3u8 = /\.m3u8(\?|$)/i.test(raw);
    const hasFileExt = /\.(mp4|mkv|avi|mov|m4v|webm)$/i.test(path);
    const bare = !hasTs && !hasM3u8 && !hasFileExt;

    // Candidate URLs in preference order; each is probed and the first that
    // actually answers becomes the primary, the rest stay as fallbacks.
    const candidates: Array<{ url: string; kind: TvStreamKind }> = [];

    if (hasM3u8) {
      candidates.push({ url: raw, kind: "hls" });
    } else if (hasFileExt) {
      candidates.push({ url: raw, kind: "file" });
      candidates.push({ url: raw, kind: "ts" });
    } else if (hasTs) {
      // Most Xtream servers expose an HLS variant of the same live stream.
      candidates.push({ url: raw.replace(/\.ts$/i, ".m3u8"), kind: "hls" });
      candidates.push({ url: raw, kind: "ts" });
    } else {
      // Extension-less Xtream link: sniff it, then try every engine.
      candidates.push({ url: `${raw}.m3u8`, kind: "hls" });
      candidates.push({ url: raw, kind: "ts" });
      candidates.push({ url: `${raw}.ts`, kind: "ts" });
    }

    // Verify candidates so the player does not burn a retry on a dead variant.
    const verified: Array<{ url: string; kind: TvStreamKind }> = [];
    for (const candidate of candidates.slice(0, 3)) {
      const sniffed = await sniffKind(candidate.url);
      if (!sniffed) continue;
      verified.push({ url: candidate.url, kind: sniffed });
    }

    if (bare && verified.length === 0) {
      // Nothing answered a range probe — still hand the raw link over.
      verified.push({ url: raw, kind: "ts" });
    }

    const ordered = verified.length > 0 ? verified : candidates;
    const primary = ordered[0]!;
    const rest = ordered.slice(1);

    return {
      url: signStreamUrl(primary.url),
      kind: primary.kind,
      fallbacks: rest.map((entry) => ({ url: signStreamUrl(entry.url), kind: entry.kind })),
    };
  });
