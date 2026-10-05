// Gives OG Bot read access to the Sports Guide feed when a user asks about
// fixtures, fights, kick-off times or which TV channel is showing an event.
import { SPORT_CATEGORIES } from "./sports-guide-parse";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
type Admin = SupabaseClient<Database>;

const SPORTS_INTENT_RE =
  /\b(sports?|fixtures?|match(es)?|games?|kick[\s-]?off|ko|fight(s|ing)?|fight night|card|bout|race|grand prix|f1|ufc|boxing|mma|wwe|darts|tennis|cricket|nba|nfl|football|soccer|premier league|champions league|ucl|epl|la ?liga|serie a|bundesliga|vs\.?|versus|playing|on tonight|on today|on tv|channel|channels|sky sports|tnt|dazn|bt sport|amazon prime|what time|when is|where can i watch|watch)\b/i;

const STOP = new Set(
  "the a an and or of to in on at for is are was be what when where which who how time today tonight tomorrow game match fixture fixtures channel channels watch playing play sport sports show showing can i me my you u it its any there this that with vs versus kick off live tv on bro mate pls please".split(
    " ",
  ),
);

export function detectSportsIntent(text: string | null | undefined): boolean {
  return !!text && SPORTS_INTENT_RE.test(text);
}

function keywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s'-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP.has(w)),
    ),
  ).slice(0, 8);
}

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/** Returns a prompt block, or "" when the message isn't about sport. */
export async function buildSportsGuideContext(admin: Admin, userId: string, text: string): Promise<string> {
  if (!detectSportsIntent(text)) return "";
  const { data: access } = await admin.rpc("has_sports_guide_access", { _user: userId });
  if (!access) return SPORTS_LOCKED_PROMPT;

  const words = keywords(text);
  const since = new Date(Date.now() - 10 * 86_400_000).toISOString();
  let rows: { raw_text: string; posted_at: string; sport_category: string; event_time: string | null; telegram_message_id: number }[] = [];
  if (words.length) {
    const or = words.map((w) => `raw_text.ilike.%${w.replace(/[%,()]/g, "")}%`).join(",");
    const { data } = await admin
      .from("sports_guide_posts")
      .select("raw_text, posted_at, sport_category, event_time, telegram_message_id")
      .or(or)
      .gte("posted_at", since)
      .order("posted_at", { ascending: false })
      .limit(40);
    rows = data ?? [];
    // Rank by how many keywords each post contains.
    rows.sort(
      (a, b) =>
        words.filter((w) => b.raw_text.toLowerCase().includes(w)).length -
        words.filter((w) => a.raw_text.toLowerCase().includes(w)).length,
    );
  }
  if (!rows.length) {
    const { data } = await admin
      .from("sports_guide_posts")
      .select("raw_text, posted_at, sport_category, event_time, telegram_message_id")
      .gte("posted_at", new Date(Date.now() - 2 * 86_400_000).toISOString())
      .order("posted_at", { ascending: false })
      .limit(12);
    rows = data ?? [];
  }

  const now = fmtDay(new Date().toISOString());
  if (!rows.length) {
    return `SPORTS GUIDE (current UK time: ${now}): The Sports Guide feed has no matching events right now. Say so honestly, don't invent fixtures or channels, and point them to https://www.ogbot.co.uk/sports for the live list.`;
  }

  let budget = 9000;
  const blocks: string[] = [];
  for (const r of rows.slice(0, 15)) {
    const cat = SPORT_CATEGORIES.find((c) => c.id === r.sport_category)?.label ?? "Other";
    const body = r.raw_text.replace(/\n?•\s*Sent via TeleFeed\s*$/i, "").trim().slice(0, 1800);
    const block = `--- Post (${cat}) published ${fmtDay(r.posted_at)} UK · https://t.me/OGSPORTSGUIDE/${r.telegram_message_id}\n${body}`;
    if (budget - block.length < 0) break;
    budget -= block.length;
    blocks.push(block);
  }

  return `SPORTS GUIDE FEED (the user's unlocked OG Sports Guide — trusted source). Current UK time: ${now}.
When the user asks about an event:
1. Find it in the posts below. Work out the exact day and date from the post's publish date (times in posts are UK time; "today"/"tonight" means the publish date; a time earlier than the publish time usually means the next day).
2. Answer with: the event, the day + date, the UK kick-off/start time, and how long until it starts if it's soon.
3. List EVERY channel/broadcaster the posts mention for that event as a short bullet list (e.g. Sky Sports Main Event, TNT Sports 1, DAZN). If no channel is listed, say the guide doesn't name one.
4. If several matching events exist, list them in time order. Never invent fixtures, times or channels that aren't in the posts. Mention https://www.ogbot.co.uk/sports for the full live list.

${blocks.join("\n\n")}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtKo = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

/** Instant Telegram reply for "/sports <query>" — same parser/search as the website. */
export async function quickSportsReply(admin: Admin, userId: string, query: string): Promise<string> {
  const { data: access } = await admin.rpc("has_sports_guide_access", { _user: userId });
  if (!access) return "🔒 <b>OG Sports Guide</b> is free for VIP (incl. the 15-day trial) or unlock it in the Store.";
  const { parseListing, dedupe, searchListing } = await import("./sports-listing");
  const { data } = await admin
    .from("sports_guide_posts")
    .select("id, raw_text, posted_at, telegram_message_id")
    .gte("posted_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("posted_at", { ascending: false })
    .limit(80);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const listings = dedupe(data ?? []).map(parseListing);
  const hits = listings.map((l) => searchListing(l, words)).filter((l): l is NonNullable<typeof l> => !!l);
  const fixtures = hits.flatMap((l) => l.fixtures);
  if (!words.length) {
    const upcoming = fixtures.filter((f) => f.at && f.at.getTime() > Date.now() - 2 * 3_600_000)
      .sort((a, b) => a.at!.getTime() - b.at!.getTime()).slice(0, 15);
    if (!upcoming.length) return "⚽ No upcoming fixtures in the guide right now.";
    return "⚽ <b>Next up</b>\n" + upcoming.map((f) => `• ${fmtKo(f.at!)} — ${esc(f.event)}\n   📺 ${esc(f.channel)}`).join("\n");
  }
  if (!fixtures.length) return `⚽ No fixtures found for "<b>${esc(query)}</b>".`;
  const seen = new Set<string>();
  const uniq = fixtures.filter((f) => !seen.has(f.raw) && seen.add(f.raw))
    .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0)).slice(0, 20);
  return `⚽ <b>${uniq.length} match${uniq.length === 1 ? "" : "es"}</b> for "${esc(query)}"\n` +
    uniq.map((f) => `• ${f.at ? fmtKo(f.at) : ""} — ${esc(f.event)}\n   📺 ${esc(f.channel)}`).join("\n");
}
