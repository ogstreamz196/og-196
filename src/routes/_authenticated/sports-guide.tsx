import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellRing, Copy, ExternalLink, Loader2, Lock, Search, Star, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import sportsGuideLogo from "@/assets/og-bot-sports-guide.png.asset.json";
import { getSportsGuideHub, toggleSportsGuideReminder, type SportsGuidePost } from "@/lib/sports-guide.functions";
import { purchaseSportsGuideAccess } from "@/lib/store.functions";
import { SPORT_CATEGORIES, SPORTS_GUIDE_USERNAME, expandQuery } from "@/lib/sports-guide-parse";

export const Route = createFileRoute("/_authenticated/sports-guide")({
  head: () => ({
    meta: [
      { title: "Sports Guide · OG BOT" },
      { name: "description", content: "Live daily fixtures, fight cards and TV listings — search any team instantly." },
      { property: "og:title", content: "Sports Guide · OG BOT" },
      { property: "og:description", content: "Live daily fixtures, fight cards and TV listings from OG Sports Guide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SportsGuidePage,
});

const STAR_KEY = "og-sports-starred";
const DAY = 86_400_000;
type When = "any" | "today" | "tomorrow" | "weekend";

function londonDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
}

function SportsGuidePage() {
  const qc = useQueryClient();
  const fetchHub = useServerFn(getSportsGuideHub);
  const buy = useServerFn(purchaseSportsGuideAccess);
  const toggleReminder = useServerFn(toggleSportsGuideReminder);
  const hub = useQuery({ queryKey: ["sports-guide-hub"], queryFn: () => fetchHub() });

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cat, setCat] = useState("all");
  const [when, setWhen] = useState<When>("any");
  const [starred, setStarred] = useState<string[]>([]);

  useEffect(() => {
    try {
      setStarred(JSON.parse(localStorage.getItem(STAR_KEY) ?? "[]"));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 120);
    return () => clearTimeout(t);
  }, [q]);

  const owned = !!hub.data?.owned;

  // Live: new and edited posts appear instantly.
  useEffect(() => {
    if (!owned) return;
    const ch = supabase
      .channel("sports-guide-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "sports_guide_posts" }, (payload) => {
        const row = payload.new as SportsGuidePost;
        if (!row?.id) return;
        qc.setQueryData(["sports-guide-hub"], (old: typeof hub.data) => {
          if (!old) return old;
          const rest = old.posts.filter((p) => p.id !== row.id);
          return { ...old, posts: [row, ...rest].sort((a, b) => b.posted_at.localeCompare(a.posted_at)) };
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [owned, qc]);

  const unlock = useMutation({
    mutationFn: () => buy(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["sports-guide-hub"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["sports-guide-access"] });
      toast.success("Sports Guide unlocked 🏆");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reminder = useMutation({
    mutationFn: (postId: string) => toggleReminder({ data: { postId, leadMinutes: 15 } }),
    onSuccess: (r, postId) => {
      qc.setQueryData(["sports-guide-hub"], (old: typeof hub.data) =>
        old
          ? { ...old, reminders: r.on ? [...old.reminders, postId] : old.reminders.filter((x) => x !== postId) }
          : old,
      );
      toast.success(r.on ? "Reminder set — OG Bot will ping you on Telegram 15 min before" : "Reminder removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const terms = useMemo(() => expandQuery(debounced), [debounced]);

  const filtered = useMemo(() => {
    const posts = hub.data?.posts ?? [];
    const today = londonDay(new Date());
    const tomorrow = londonDay(new Date(Date.now() + DAY));
    return posts.filter((p) => {
      if (cat !== "all" && p.sport_category !== cat) return false;
      if (when !== "any") {
        const d = londonDay(new Date(p.posted_at));
        if (when === "today" && d !== today) return false;
        if (when === "tomorrow" && d !== tomorrow) return false;
        if (when === "weekend") {
          const wd = new Date(p.posted_at).getDay();
          const age = Date.now() - new Date(p.posted_at).getTime();
          if (!(wd === 0 || wd === 5 || wd === 6) || age > 7 * DAY) return false;
        }
      }
      if (terms.length) {
        const t = p.raw_text.toLowerCase();
        return terms.some((term) => t.includes(term));
      }
      return true;
    });
  }, [hub.data?.posts, cat, when, terms]);

  const favs = useMemo(
    () =>
      starred.length
        ? filtered.filter((p) => starred.some((s) => p.raw_text.toLowerCase().includes(s.toLowerCase())))
        : [],
    [filtered, starred],
  );

  const saveStars = (next: string[]) => {
    setStarred(next);
    localStorage.setItem(STAR_KEY, JSON.stringify(next));
  };
  const starCurrent = () => {
    const term = q.trim();
    if (!term) return;
    if (starred.some((s) => s.toLowerCase() === term.toLowerCase())) {
      saveStars(starred.filter((s) => s.toLowerCase() !== term.toLowerCase()));
      toast("Removed from favourites");
    } else {
      saveStars([...starred, term].slice(0, 20));
      toast.success(`⭐ ${term} pinned to Your Favourites`);
    }
  };

  if (hub.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!owned) {
    const price = hub.data?.coinPrice;
    const balance = hub.data?.balance ?? 0;
    const short = price != null && balance < price;
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 pb-24 pt-4">
        <div className="overflow-hidden rounded-3xl border-2 border-primary/40 bg-card shadow-glow">
          <div className="relative">
            <img src={sportsGuideLogo.url} alt="OG Sports Guide" className="aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-0 grid place-items-center bg-background/55 backdrop-blur-[2px]">
              <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-primary bg-background/80">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <h1 className="font-display text-2xl font-black uppercase">OG Sports Guide</h1>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>⚽ Every daily fixture, fight card & race — updated live</li>
              <li>🔎 Type any team or fighter and find their event instantly</li>
              <li>⭐ Pin your teams so they're always at the top</li>
              <li>🔔 Telegram kick-off reminders from OG Bot</li>
            </ul>
            <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Your balance: {balance} coins</span>
              <span className="font-mono text-lg font-black text-coin">
                {price != null ? `${price} OG Coins` : "—"}
              </span>
            </div>
            {short ? (
              <Button asChild className="w-full bg-gradient-brand font-bold uppercase">
                <Link to="/buy-coins">Top up coins to unlock</Link>
              </Button>
            ) : (
              <Button
                className="w-full bg-gradient-brand font-bold uppercase"
                disabled={unlock.isPending || price == null}
                onClick={() => unlock.mutate()}
              >
                {unlock.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Unlock Sports Guide
              </Button>
            )}
            <p className="text-center text-[11px] text-muted-foreground">One-time unlock · yours to keep</p>
          </div>
        </div>
      </div>
    );
  }

  const isStarred = starred.some((s) => s.toLowerCase() === q.trim().toLowerCase());
  const reminders = new Set(hub.data?.reminders ?? []);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-24 pt-3">
      <header className="flex items-center gap-3">
        <img src={sportsGuideLogo.url} alt="" className="h-12 w-12 rounded-xl border border-primary/40 object-cover" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-black uppercase leading-tight">Sports Guide</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Live feed · {hub.data?.posts.length ?? 0}{" "}
            posts
          </p>
        </div>
      </header>

      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-background/90 px-4 py-2 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search team, fighter, league…"
            className="h-12 rounded-2xl pl-9 pr-20 text-base"
            inputMode="search"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
            {q && (
              <>
                <button
                  aria-label={isStarred ? "Unstar" : "Star this search"}
                  onClick={starCurrent}
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
                >
                  <Star className={cn("h-4 w-4", isStarred ? "fill-coin text-coin" : "text-muted-foreground")} />
                </button>
                <button
                  aria-label="Clear search"
                  onClick={() => setQ("")}
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {SPORT_CATEGORIES.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
              {c.emoji} {c.label}
            </Chip>
          ))}
        </div>
        <div className="flex gap-2">
          {(["any", "today", "tomorrow", "weekend"] as When[]).map((w) => (
            <Chip key={w} active={when === w} onClick={() => setWhen(w)} small>
              {w === "any" ? "Any day" : w === "weekend" ? "Weekend" : w[0].toUpperCase() + w.slice(1)}
            </Chip>
          ))}
        </div>
        {starred.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {starred.map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className="inline-flex items-center gap-1 rounded-full border border-coin/40 bg-coin/10 px-2 py-0.5 text-[11px] font-bold text-coin"
              >
                <Star className="h-3 w-3 fill-current" /> {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {favs.length > 0 && !debounced && (
        <section className="space-y-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-coin">⭐ Your favourites</h2>
          {favs.slice(0, 10).map((p) => (
            <PostCard key={`f-${p.id}`} post={p} terms={starred.map((s) => s.toLowerCase())} reminded={reminders.has(p.id)} onRemind={() => reminder.mutate(p.id)} />
          ))}
        </section>
      )}

      <section className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {hub.data?.posts.length ? "No events match — try another team or filter." : "New events will appear here as soon as they're posted."}
          </p>
        ) : (
          filtered.map((p) => (
            <PostCard key={p.id} post={p} terms={terms} reminded={reminders.has(p.id)} onRemind={() => reminder.mutate(p.id)} />
          ))
        )}
      </section>
    </div>
  );
}

function Chip({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: ReactNode; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border font-bold transition-colors",
        small ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const esc = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!esc.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${esc.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-coin/30 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function PostCard({ post, terms, reminded, onRemind }: { post: SportsGuidePost; terms: string[]; reminded: boolean; onRemind: () => void }) {
  const [open, setOpen] = useState(false);
  const cat = SPORT_CATEGORIES.find((c) => c.id === post.sport_category) ?? SPORT_CATEGORIES[SPORT_CATEGORIES.length - 1];
  const text = post.raw_text.replace(/\n?•\s*Sent via TeleFeed\s*$/i, "").trim();
  const long = text.length > 360;
  const shown = open || !long || terms.length ? text : `${text.slice(0, 360)}…`;
  const posted = new Date(post.posted_at);
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase">
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
          {cat.emoji} {cat.label}
        </span>
        {post.event_time && <span className="rounded-full bg-coin/15 px-2 py-0.5 text-coin">⏰ {post.event_time}</span>}
        <span className="ml-auto font-normal normal-case text-muted-foreground">
          {posted.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
        </span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
        <Highlight text={shown} terms={terms} />
      </p>
      {long && !terms.length && (
        <button onClick={() => setOpen(!open)} className="mt-1 text-xs font-bold text-primary">
          {open ? "Show less" : "Show full post"}
        </button>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {post.event_time && (
          <Button size="sm" variant={reminded ? "default" : "outline"} onClick={onRemind} className="h-8 text-xs">
            {reminded ? <BellRing className="mr-1 h-3.5 w-3.5" /> : <Bell className="mr-1 h-3.5 w-3.5" />}
            {reminded ? "Reminder on" : "Remind me"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => {
            navigator.clipboard?.writeText(text);
            toast.success("Copied");
          }}
        >
          <Copy className="mr-1 h-3.5 w-3.5" /> Copy
        </Button>
        <Button size="sm" variant="ghost" asChild className="h-8 text-xs">
          <a href={`https://t.me/${SPORTS_GUIDE_USERNAME}/${post.telegram_message_id}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Telegram
          </a>
        </Button>
      </div>
    </article>
  );
}
