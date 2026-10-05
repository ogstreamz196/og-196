// Server-only helpers for Sports Guide reminders.
export async function sendTelegramText(chatId: number, html: string): Promise<boolean> {
  const botToken = process.env.OG_BOT_TOKEN;
  const tgKey = process.env.TELEGRAM_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  const url = botToken
    ? `https://api.telegram.org/bot${botToken}/sendMessage`
    : "https://connector-gateway.lovable.dev/telegram/sendMessage";
  if (!botToken && (!tgKey || !lovableKey)) return false;
  const headers: Record<string, string> = botToken
    ? { "Content-Type": "application/json" }
    : {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": tgKey as string,
        "Content-Type": "application/json",
      };
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
  }).catch(() => null);
  if (!r) return false;
  const j = (await r.json().catch(() => null)) as { ok?: boolean } | null;
  return !!j?.ok;
}

/** London wall-clock "HH:MM" on/after the post date -> UTC instant. */
export function eventInstant(postedAtIso: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const posted = new Date(postedAtIso);
  const londonDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(posted);
  const build = (dateStr: string) => {
    // Interpret as London time by measuring the offset at that moment.
    const guess = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
    const londonHour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(guess),
    );
    const offsetH = (londonHour - guess.getUTCHours() + 24) % 24;
    return new Date(guess.getTime() - offsetH * 3600_000);
  };
  let at = build(londonDate);
  if (at.getTime() < posted.getTime() - 3600_000) at = new Date(at.getTime() + 24 * 3600_000);
  return at;
}
