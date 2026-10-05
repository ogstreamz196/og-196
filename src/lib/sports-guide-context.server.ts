// Gives OG Bot read access to the Sports Guide feed when a user asks about
// fixtures, fights, kick-off times or which TV channel is showing an event.
import { SPORT_CATEGORIES } from "./sports-guide-parse";

type Admin = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

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
  if (!access) {
    return `SPORTS GUIDE: The user asked about sport, but they haven't unlocked the OG Sports Guide. Don't list fixtures or channels from it. Tell them in your voice it's free for VIP (including the 15-day free trial) or can be unlocked in the Store, and the page is https://www.ogbot.co.uk/sports.`;
  }

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
