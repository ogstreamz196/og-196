/**
 * Shared TV catalogue ingest.
 *
 * The provider playlist is ~100MB / 400k entries, so it is parsed line by line
 * straight off the response stream and written in batches — it is never held in
 * memory in full. Credentials are stripped out of every stored link and replaced
 * with {U}/{P} placeholders, so each viewer streams with their own account.
 */

export const TV_HOSTS = ["http://xiu96ctyh6-system.xyz:80", "http://xiu96ctyh6-system.xyz"];

const BATCH = 5000;

type Row = {
  generation: string;
  section: string;
  category: string;
  title: string;
  logo: string | null;
  url_template: string;
  idx: number;
};

function classify(group: string, url: string): string {
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

export function templatizeUrl(url: string, username: string, password: string): string {
  return url
    .split(encodeURIComponent(username)).join("{U}")
    .split(username).join("{U}")
    .split(encodeURIComponent(password)).join("{P}")
    .split(password).join("{P}");
}

export function applyCredentials(template: string, username: string, password: string): string {
  return template
    .split("{U}").join(encodeURIComponent(username))
    .split("{P}").join(encodeURIComponent(password));
}

export function playlistUrl(host: string, username: string, password: string): string {
  return (
    `${host}/get.php?username=${encodeURIComponent(username)}` +
    `&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`
  );
}

export async function syncTvCatalog(
  username: string,
  password: string,
  generation: string,
): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let body: ReadableStream<Uint8Array> | null = null;
  for (const host of TV_HOSTS) {
    try {
      const response = await fetch(playlistUrl(host, username, password), {
        headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", Accept: "*/*" },
      });
      if (response.ok && response.body) {
        body = response.body;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!body) throw new Error("Could not download the playlist from the provider.");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pending: { title: string; group: string; logo: string | null } | null = null;
  let rows: Row[] = [];
  let total = 0;

  const flush = async () => {
    if (rows.length === 0) return;
    const batch = rows;
    rows = [];
    const { error } = await supabaseAdmin.from("tv_catalog_items").insert(batch);
    if (error) throw new Error(error.message);
  };

  const handle = async (raw: string) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith("#EXTINF")) {
      const comma = line.indexOf(",");
      const title = (comma >= 0 ? line.slice(comma + 1) : "").trim();
      pending = {
        title: title || attr(line, "tvg-name") || "Untitled",
        group: attr(line, "group-title") || "Uncategorised",
        logo: attr(line, "tvg-logo"),
      };
      return;
    }
    if (line.startsWith("#") || !pending) return;
    rows.push({
      generation,
      section: classify(pending.group, line),
      category: pending.group,
      title: pending.title,
      logo: pending.logo,
      url_template: templatizeUrl(line, username, password),
      idx: total,
    });
    total += 1;
    pending = null;
    if (rows.length >= BATCH) await flush();
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      await handle(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  if (buffer) await handle(buffer);
  await flush();

  if (total === 0) throw new Error("The provider returned an empty playlist.");

  const { error } = await supabaseAdmin.rpc("tv_catalog_finish", {
    _generation: generation,
    _total: total,
  });
  if (error) throw new Error(error.message);
  return total;
}
