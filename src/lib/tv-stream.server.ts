import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed stream proxy helpers.
 *
 * Browsers cannot play the provider's plain-HTTP, CORS-less streams from an
 * HTTPS page, so playback is relayed through a same-origin route. Nothing is
 * stored: bytes are streamed through and discarded. Links are HMAC signed and
 * short lived so the relay cannot be used as an open proxy.
 */

export const TV_PROXY_PATH = "/api/public/tv/stream";
const TTL_MS = 6 * 60 * 60 * 1000;

function key(): string {
  return (
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    "tv-hub-fallback-key"
  );
}

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function unb64url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(url: string, expires: number): string {
  return createHmac("sha256", key()).update(`${url}|${expires}`).digest("base64url");
}

export function signStreamUrl(upstream: string, expires = Date.now() + TTL_MS): string {
  const params = new URLSearchParams({
    u: b64url(upstream),
    e: String(expires),
    s: sign(upstream, expires),
  });
  return `${TV_PROXY_PATH}?${params.toString()}`;
}

export function verifyStreamUrl(search: URLSearchParams): string | null {
  const u = search.get("u");
  const e = search.get("e");
  const s = search.get("s");
  if (!u || !e || !s) return null;
  const expires = Number(e);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;

  let upstream: string;
  try {
    upstream = unb64url(u);
  } catch {
    return null;
  }
  const expected = Buffer.from(sign(upstream, expires));
  const given = Buffer.from(s);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return upstream;
}

/** Rewrite every media/playlist reference inside an M3U8 so it also goes through the relay. */
export function rewritePlaylist(text: string, upstream: string, expires: number): string {
  const base = new URL(upstream);
  const absolute = (ref: string) => {
    try {
      return new URL(ref, base).toString();
    } catch {
      return null;
    }
  };

  return text
    .split(/\r?\n/)
    .map((raw) => {
      const line = raw.trim();
      if (!line) return raw;
      if (line.startsWith("#")) {
        return raw.replace(/URI="([^"]+)"/g, (match, ref: string) => {
          const target = absolute(ref);
          return target ? `URI="${signStreamUrl(target, expires)}"` : match;
        });
      }
      const target = absolute(line);
      return target ? signStreamUrl(target, expires) : raw;
    })
    .join("\n");
}
