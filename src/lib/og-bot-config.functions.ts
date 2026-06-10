import { createServerFn } from "@tanstack/react-start";

/**
 * Returns the OG Bot widget loader URL + token for SSR injection
 * into the document. Token is read from server env only.
 */
export const getOgBotWidgetConfig = createServerFn({ method: "GET" }).handler(async () => {
  const host = process.env.OG_BOT_HOST ?? "";
  const token = process.env.OG_BOT_TOKEN ?? "";
  if (!host || !token) return { loaderUrl: "", token: "" };
  return {
    loaderUrl: `${host.replace(/\/$/, "")}/api/public/og-bot-widget-embed.js`,
    token,
  };
});
