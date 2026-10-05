import { createFileRoute, Link } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, Loader2, Lock, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import sportsGuideLogo from "@/assets/og-bot-sports-guide.png.asset.json";
import { getSportsGuideHub, type SportsGuidePost } from "@/lib/sports-guide.functions";
import { purchaseSportsGuideAccess } from "@/lib/store.functions";
import { SPORTS_GUIDE_USERNAME } from "@/lib/sports-guide-parse";

export const Route = createFileRoute("/_authenticated/sports")({
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

const KEY = ["sports-guide-hub"];
const clean = (t: string) => t.replace(/\n?•\s*Sent via TeleFeed\s*$/i, "").trim();

function SportsGuidePage() {
  const qc = useQueryClient();
  const fetchHub = useServerFn(getSportsGuideHub);
  const buy = useServerFn(purchaseSportsGuideAccess);
  const hub = useQuery({
    queryKey: KEY,
    queryFn: () => fetchHub(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
  });
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const owned = !!hub.data?.owned;

  // Always listening: new, edited and deleted posts sync instantly.
  useEffect(() => {
    if (!owned) return;
    const ch = supabase
      .channel(`sports-guide-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sports_guide_posts" }, (payload) => {
        qc.setQueryData(KEY, (old: typeof hub.data) => {
          if (!old) return old;
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string })?.id;
            return { ...old, posts: old.posts.filter((p) => p.id !== id) };
          }
          const row = payload.new as SportsGuidePost;
          if (!row?.id) return old;
          const rest = old.posts.filter((p) => p.id !== row.id);
          return { ...old, posts: [row, ...rest].sort((a, b) => b.posted_at.localeCompare(a.posted_at)) };
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") qc.invalidateQueries({ queryKey: KEY });
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [owned, qc]);

  const unlock = useMutation({
    mutationFn: () => buy(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["sports-guide-access"] });
      toast.success("Sports Guide unlocked 🏆");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const words = useMemo(() => dq.toLowerCase().split(/\s+/).filter(Boolean), [dq]);
  const results = useMemo(() => {
    const posts = hub.data?.posts ?? [];
    if (!words.length) return posts;
    return posts.filter((p) => {
      const t = p.raw_text.toLowerCase();
      return words.every((w) => t.includes(w));
    });
  }, [hub.data?.posts, words]);

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
            <Link
              to="/buy-coins"
              className="block rounded-xl border border-coin/40 bg-coin/10 px-4 py-3 text-center text-xs font-bold text-coin"
            >
              👑 Free for VIP members — including the 15-day free trial. Go VIP →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const total = hub.data?.posts.length ?? 0;
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 pb-24 pt-3">
      <header className="flex items-center gap-3">
        <img src={sportsGuideLogo.url} alt="" className="h-11 w-11 rounded-xl border border-primary/40 object-cover" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-black uppercase leading-tight">Sports Guide</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Live · {total} posts
          </p>
        </div>
      </header>

      <div className="sticky top-0 z-10 -mx-4 bg-background/90 px-4 py-2 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search team, fighter, channel…"
            className="h-12 rounded-2xl pl-9 pr-10 text-base"
            inputMode="search"
            autoComplete="off"
          />
          {q && (
            <button
              aria-label="Clear search"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {words.length > 0 && (
          <p className="mt-1.5 px-1 text-xs text-muted-foreground">
            {results.length} {results.length === 1 ? "match" : "matches"}
          </p>
        )}
      </div>

      <section className="space-y-2">
        {results.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {total ? "No messages match — try another word." : "New messages will appear here as soon as they're posted."}
          </p>
        ) : (
          results.map((p) => <PostCard key={p.id} post={p} terms={words} />)
        )}
      </section>
    </div>
  );
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!esc.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${esc.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-coin/30 px-0.5 text-foreground">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function PostCard({ post, terms }: { post: SportsGuidePost; terms: string[] }) {
  const text = clean(post.raw_text);
  const posted = new Date(post.posted_at);
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-2 text-[11px] text-muted-foreground">
        {posted.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
        <Highlight text={text} terms={terms} />
      </p>
      <div className="mt-3 flex gap-2">
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
