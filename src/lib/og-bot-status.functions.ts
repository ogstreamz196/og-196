import { createServerFn } from "@tanstack/react-start";

/**
 * Quick reachability probe against the OG Bot backend.
 * Does not require a token — we just confirm the host responds.
 */
export const pingOgBot = createServerFn({ method: "GET" }).handler(async () => {
  const host = process.env.OG_BOT_HOST;
  if (!host) return { ok: false, status: 0, host: null as string | null, error: "OG_BOT_HOST not set" };
  const url = `${host.replace(/\/$/, "")}/api/public/og-bot-widget-embed.js`;
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { method: "GET" });
    return {
      ok: res.ok,
      status: res.status,
      host,
      latencyMs: Date.now() - startedAt,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      host,
      latencyMs: Date.now() - startedAt,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
});
