import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Expand,
  Film,
  Heart,
  LayoutGrid,
  ListVideo,
  Loader2,
  LockKeyhole,
  MonitorPlay,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Tv,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import tvHubCinematic from "@/assets/tv-hub-cinematic.jpg";
import {
  getTvCatalogStatus,
  getTvCategories,
  getTvItems,
  prepareTvStream,
  refreshTvCatalog,
  signInTvHub,
  type TvAccount,
  type TvCatalogStatus,
  type TvCategory,
  type TvChannel,
} from "@/lib/tv-hub.functions";

export const Route = createFileRoute("/_authenticated/tv-hub")({
  head: () => ({
    meta: [
      { title: "TV HUB — OG BOT" },
      { name: "description", content: "Watch live TV, movies and series in the cinematic OG BOT TV HUB." },
      { property: "og:title", content: "TV HUB — OG BOT" },
      { property: "og:description", content: "A cinematic home for live TV, movies, series and programme guides." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TvHubPage,
});

type Section = "tv" | "movies" | "series";

type Creds = { username: string; password: string };

const SECTIONS: Array<{ id: Section; label: string; caption: string; icon: typeof Tv }> = [
  { id: "tv", label: "Live TV", caption: "Channels & sport", icon: Radio },
  { id: "movies", label: "Movies", caption: "Films on demand", icon: Film },
  { id: "series", label: "Series", caption: "Box sets & shows", icon: ListVideo },
];

const PAGE_SIZE = 200;

function formatExpiry(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const label = date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  if (days < 0) return { label, note: "Expired", expired: true };
  return { label, note: days === 0 ? "Expires today" : `${days} day${days === 1 ? "" : "s"} left`, expired: false };
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  return `${mins}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function TvHubPage() {
  const signIn = useServerFn(signInTvHub);
  const loadCategories = useServerFn(getTvCategories);
  const loadItems = useServerFn(getTvItems);
  const runRefresh = useServerFn(refreshTvCatalog);
  const loadStatus = useServerFn(getTvCatalogStatus);

  const [creds, setCreds] = useState<Creds | null>(null);
  const [account, setAccount] = useState<TvAccount | null>(null);
  const [catalog, setCatalog] = useState<TvCatalogStatus | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");

  const [categories, setCategories] = useState<Record<Section, TvCategory[]>>({ tv: [], movies: [], series: [] });
  const [section, setSection] = useState<Section | null>(null);
  const [group, setGroup] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<TvChannel[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<TvChannel | null>(null);
  const [favourites, setFavourites] = useState<string[]>([]);

  const expiry = formatExpiry(account?.expiresAt ?? null);
  const ready = catalog?.status === "ready";
  const searching = search.length > 0;

  /* master search is typed-through, so debounce before hitting the catalogue */
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  /* cached categories — instant for every user, no provider download */
  useEffect(() => {
    if (!creds || !ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const [tv, movies, series] = await Promise.all([
          loadCategories({ data: { section: "tv" } }),
          loadCategories({ data: { section: "movies" } }),
          loadCategories({ data: { section: "series" } }),
        ]);
        if (!cancelled) setCategories({ tv, movies, series });
      } catch {
        /* categories stay empty; the guide still works via search */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalog?.refreshedAt, creds, loadCategories, ready]);

  /* the visible page of the guide */
  useEffect(() => {
    if (!creds || !section || !ready) return;
    let cancelled = false;
    setItemsLoading(true);
    void (async () => {
      try {
        const rows = await loadItems({
          data: {
            section,
            category: searching || group === "All" ? null : group,
            search: searching ? search : null,
            limit: PAGE_SIZE,
            offset: 0,
          },
        });
        if (cancelled) return;
        setItems(rows);
        setHasMore(rows.length === PAGE_SIZE);
        setSelected((current) => current ?? rows[0] ?? null);
      } catch {
        if (!cancelled) {
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creds, group, loadItems, ready, search, searching, section]);

  /* while a refresh runs, keep the status fresh for everyone watching it */
  useEffect(() => {
    if (!refreshing) return;
    const timer = window.setInterval(() => {
      void loadStatus().then(setCatalog).catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [loadStatus, refreshing]);

  const showMore = async () => {
    if (!section) return;
    setItemsLoading(true);
    try {
      const rows = await loadItems({
        data: {
          section,
          category: searching || group === "All" ? null : group,
          search: searching ? search : null,
          limit: PAGE_SIZE,
          offset: items.length,
        },
      });
      setItems((current) => [...current, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setItemsLoading(false);
    }
  };

  const openSection = (next: Section) => {
    setSection(next);
    setGroup("All");
    setQuery("");
    setSearch("");
    setItems([]);
    setSelected(null);
  };

  const step = (direction: -1 | 1) => {
    if (items.length === 0) return;
    const index = items.findIndex((item) => item.id === selected?.id);
    const next = items[(index + direction + items.length) % items.length];
    if (next) setSelected(next);
  };

  const startRefresh = async (withCreds: Creds) => {
    setRefreshing(true);
    setCatalog((current) => ({
      status: "running",
      total: current?.total ?? 0,
      refreshedAt: current?.refreshedAt ?? null,
      error: null,
    }));
    try {
      await runRefresh({ data: withCreds });
      setCatalog(await loadStatus());
    } catch (error) {
      setCatalog({
        status: "error",
        total: 0,
        refreshedAt: null,
        error: error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setLoginMessage("Enter your username and password.");
      return;
    }
    setLoading(true);
    setLoginMessage("");
    const next: Creds = { username: username.trim(), password };
    try {
      const result = await signIn({ data: next });
      setCreds(next);
      setAccount(result.account);
      setCatalog(result.catalog);
      setPassword("");
      setSection(null);
      if (result.catalog.status !== "ready" && result.catalog.status !== "running") {
        void startRefresh(next);
      }
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------------- login */
  if (!creds) {
    return (
      <main className="relative isolate min-h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-card sm:rounded-3xl">
        <img
          src={tvHubCinematic}
          alt="Cinematic television screen lit with blue and red broadcast light"
          width={1600}
          height={900}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/90 to-surface/40" />
        <div className="relative mx-auto flex min-h-[calc(100dvh-7rem)] max-w-6xl items-end px-4 py-8 sm:items-center sm:px-8 lg:px-12">
          <section className="w-full max-w-xl rounded-2xl border border-border bg-card/95 p-5 shadow-card backdrop-blur-xl sm:p-8" aria-labelledby="tv-login-title">
            <div className="mb-6 flex items-center gap-3 sm:gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow sm:h-14 sm:w-14">
                <MonitorPlay className="h-6 w-6 sm:h-7 sm:w-7" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Entertainment Portal</p>
                <h1 id="tv-login-title" className="font-display text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">OGSTREAMZ</h1>
              </div>
            </div>

            <p className="mb-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Sign in with the username and password from your TV provider. Your details are never saved and are only
              used to play your own streams. OGSTREAMZ does not host, store or control any of the content you watch.
            </p>

            <form className="space-y-4" onSubmit={handleSignIn}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span>Username</span>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="Username" className="h-11 bg-background/70" />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span>Password</span>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Password" className="h-11 bg-background/70" />
                </label>
              </div>
              {loginMessage && (
                <p role="status" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">{loginMessage}</p>
              )}
              <Button type="submit" size="lg" className="h-12 w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                {loading ? "Signing you in" : "Sign in"}
              </Button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  const counts: Record<Section, number> = {
    tv: categories.tv.reduce((sum, entry) => sum + entry.count, 0),
    movies: categories.movies.reduce((sum, entry) => sum + entry.count, 0),
    series: categories.series.reduce((sum, entry) => sum + entry.count, 0),
  };

  const signOut = () => {
    setCreds(null);
    setAccount(null);
    setSection(null);
    setSelected(null);
    setItems([]);
    setQuery("");
    setSearch("");
    setGroup("All");
  };

  const refreshButton = (
    <Button
      type="button"
      variant="outline"
      className="h-10"
      disabled={refreshing || catalog?.status === "running"}
      onClick={() => void startRefresh(creds)}
    >
      {refreshing || catalog?.status === "running" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {refreshing || catalog?.status === "running" ? "Refreshing" : "Refresh"}
    </Button>
  );

  /* ------------------------------------------------------------ dashboard */
  if (!section) {
    return (
      <main className="relative isolate min-h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-card sm:rounded-3xl">
        <img src={tvHubCinematic} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface/80 via-surface/95 to-surface" />
        <div className="relative flex min-h-[calc(100dvh-7rem)] flex-col p-4 sm:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow"><MonitorPlay className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  {(catalog?.total ?? 0).toLocaleString()} items ready
                </p>
                <h1 className="font-display text-2xl font-black uppercase leading-none sm:text-3xl">TV HUB</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {refreshButton}
              <Button type="button" variant="outline" className="h-10" onClick={signOut}>Sign out</Button>
            </div>
          </header>

          <AccountBar account={account} expiry={expiry} catalog={catalog} />

          {catalog?.status === "running" && (
            <p className="mb-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
              Updating the channel list from your provider. This takes a few minutes — you can keep browsing the
              current list while it finishes.
            </p>
          )}
          {catalog?.status === "error" && (
            <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
              {catalog.error ?? "The last update failed."} Try Refresh again.
            </p>
          )}
          {catalog?.status === "idle" && (
            <p className="mb-4 rounded-xl border border-border bg-card/80 p-3 text-sm text-muted-foreground">
              No channel list yet — press Refresh to load it for everyone.
            </p>
          )}

          <div className="grid flex-1 content-center gap-4 sm:grid-cols-3">
            {SECTIONS.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={!ready}
                  onClick={() => openSection(entry.id)}
                  className="group relative min-h-40 overflow-hidden rounded-2xl border border-border bg-card/80 p-5 text-left transition hover:border-primary hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-56 sm:p-6"
                >
                  <span className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/25" />
                  <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Icon className="h-6 w-6" /></span>
                  <span className="relative mt-4 block font-display text-2xl font-black uppercase leading-none sm:mt-8 sm:text-3xl">{entry.label}</span>
                  <span className="relative mt-2 block text-sm text-muted-foreground">{entry.caption}</span>
                  <span className="relative mt-3 block text-xs font-bold uppercase tracking-wide text-primary">
                    {counts[entry.id].toLocaleString()} available
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
            Everything here streams directly from your own provider account. OG BOT does not host, store or control this
            content and takes no responsibility for it.
          </p>
        </div>
      </main>
    );
  }

  /* -------------------------------------------------------------- browser */
  const activeSection = SECTIONS.find((entry) => entry.id === section)!;
  const sectionCategories = categories[section];

  const listLabel = searching
    ? `Results · ${items.length}${hasMore ? "+" : ""}`
    : group === "All"
      ? `All ${activeSection.label} · ${counts[section].toLocaleString()}`
      : `${group} · ${(sectionCategories.find((entry) => entry.name === group)?.count ?? items.length).toLocaleString()}`;

  return (
    <main className="flex min-h-[calc(100dvh-7rem)] flex-col rounded-2xl border border-border bg-surface shadow-card sm:rounded-3xl">
      {/* top bar */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-t-2xl border-b border-border bg-card/90 p-2.5 backdrop-blur-xl sm:gap-3 sm:rounded-t-3xl sm:p-3">
        <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Back to TV HUB menu" onClick={() => setSection(null)}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">OGSTREAMZ</p>
          <h1 className="truncate font-display text-lg font-black uppercase leading-none sm:text-xl">{activeSection.label}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {expiry && (
            <span
              className={cn(
                "hidden rounded-full border px-3 py-1 text-[11px] font-bold md:inline",
                expiry.expired
                  ? "border-destructive/50 bg-destructive/10 text-foreground"
                  : "border-border bg-background/60 text-muted-foreground",
              )}
            >
              Expires {expiry.label} · {expiry.note}
            </span>
          )}
          <Button type="button" variant="outline" className="h-9" onClick={signOut}>Sign out</Button>
        </div>
      </header>

      {/* player stays pinned while the guide scrolls with the page */}
      <section
        className="sticky top-14 z-20 min-w-0 border-b border-border bg-background/95 p-2 backdrop-blur-xl sm:top-16 sm:p-3"
        aria-label="Player"
      >
        <div className="mx-auto w-full max-w-4xl">
          <StreamPlayer
            title={selected?.title ?? "Choose something to watch"}
            group={selected?.group ?? activeSection.label}
            source={selected?.url ?? null}
            credentials={creds}
            live={section === "tv"}
            onPrevious={() => step(-1)}
            onNext={() => step(1)}
          />
        </div>
      </section>

      {/* search */}
      <div className="border-b border-border bg-card/70 p-2 sm:p-3">
        <div className="relative mx-auto w-full max-w-4xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search all ${activeSection.label.toLowerCase()}`}
            className="h-10 bg-background/70 pl-9"
            aria-label={`Search all ${activeSection.label}`}
          />
        </div>
      </div>

      {/* category tabs */}
      {!searching && (
        <div
          role="tablist"
          aria-label="Categories"
          className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-border bg-background/40 px-2 py-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [touch-action:pan-x_pan-y] sm:px-3 [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            role="tab"
            aria-selected={group === "All"}
            onClick={() => setGroup("All")}
            className={cn(
              "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition",
              group === "All"
                ? "border-primary bg-primary text-primary-foreground shadow-glow"
                : "border-border bg-card/70 text-muted-foreground hover:border-primary/60 hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />All
            <span className="opacity-70">{counts[section].toLocaleString()}</span>
          </button>
          {sectionCategories.map((entry) => (
            <button
              key={entry.name}
              type="button"
              role="tab"
              aria-selected={group === entry.name}
              onClick={() => setGroup(entry.name)}
              className={cn(
                "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition",
                group === entry.name
                  ? "border-primary bg-primary text-primary-foreground shadow-glow"
                  : "border-border bg-card/70 text-muted-foreground hover:border-primary/60 hover:text-foreground",
              )}
            >
              <span className="max-w-[12rem] truncate">{entry.name}</span>
              <span className="opacity-70">{entry.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* guide list */}
      <section className="flex min-w-0 flex-1 flex-col" aria-label={`${activeSection.label} guide`}>
        <p className="border-b border-border bg-card/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {listLabel}
        </p>
        <div className="mx-auto w-full max-w-4xl p-2 sm:p-3">
          <ul className="space-y-1">
            {items.map((item, index) => {
              const active = item.id === selected?.id;
              const favourite = favourites.includes(item.id);
              return (
                <li
                  key={item.id}
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2 py-2 transition sm:gap-3 sm:px-3",
                    active
                      ? "border-primary bg-primary/15 shadow-glow"
                      : "border-border/60 bg-card/50 hover:border-primary/50 hover:bg-card",
                  )}
                >
                  <span className="hidden w-10 shrink-0 text-center text-xs font-black tabular-nums text-muted-foreground sm:block">
                    {(index + 1).toString().padStart(3, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="col-start-2 flex min-w-0 items-center gap-2.5 text-left focus-visible:outline-none sm:gap-3"
                  >
                    {item.logo ? (
                      <img src={item.logo} alt="" aria-hidden loading="lazy" className="h-9 w-12 shrink-0 rounded bg-background object-contain p-0.5 sm:h-10 sm:w-14" />
                    ) : (
                      <span className="grid h-9 w-12 shrink-0 place-items-center rounded bg-background text-muted-foreground sm:h-10 sm:w-14"><Tv className="h-4 w-4" /></span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold sm:text-[15px]">{item.title}</span>
                      <span className="block truncate text-[11px] uppercase tracking-wide text-muted-foreground">{item.group}</span>
                    </span>
                  </button>
                  <span className="flex shrink-0 items-center gap-1">
                    {active && (
                      <span className="hidden rounded bg-primary/20 px-2 py-0.5 text-[10px] font-black uppercase text-primary sm:inline">
                        Watching
                      </span>
                    )}
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className={favourite ? "text-primary" : "text-muted-foreground"}
                      aria-label={favourite ? `Remove ${item.title} from favourites` : `Add ${item.title} to favourites`}
                      onClick={() => setFavourites((current) => favourite ? current.filter((id) => id !== item.id) : [...current, item.id])}
                    >
                      <Heart className={cn("h-4 w-4", favourite && "fill-current")} />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
          {itemsLoading && (
            <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading
            </p>
          )}
          {!itemsLoading && items.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Nothing here matches your search.</p>
          )}
          {hasMore && !itemsLoading && (
            <div className="p-3 text-center">
              <p className="mb-2 text-xs text-muted-foreground">Showing {items.length}</p>
              <Button type="button" variant="outline" className="h-9 w-full max-w-sm" onClick={() => void showMore()}>
                Show more
              </Button>
            </div>
          )}
          <p className="px-1 pb-2 pt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            Streams come directly from your provider account. OGSTREAMZ does not host, store or control this content.
          </p>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------- account ---- */

function AccountBar({
  account,
  expiry,
  catalog,
}: {
  account: TvAccount | null;
  expiry: { label: string; note: string; expired: boolean } | null;
  catalog: TvCatalogStatus | null;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/80 p-3 text-xs sm:text-sm">
      <span className="rounded-full border border-border bg-background/60 px-3 py-1 font-bold">
        {account?.username ? `Account ${account.username}` : "Account"}
      </span>
      {expiry ? (
        <span
          className={cn(
            "rounded-full border px-3 py-1 font-bold",
            expiry.expired
              ? "border-destructive/50 bg-destructive/10 text-foreground"
              : "border-primary/50 bg-primary/10 text-foreground",
          )}
        >
          Expires {expiry.label} · {expiry.note}
        </span>
      ) : (
        <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-muted-foreground">
          Expiry unavailable
        </span>
      )}
      {account?.status && (
        <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-muted-foreground">
          Status {account.status}
        </span>
      )}
      {account?.maxConnections && (
        <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-muted-foreground">
          {account.activeConnections ?? 0}/{account.maxConnections} connections
        </span>
      )}
      <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-muted-foreground">
        {(catalog?.total ?? 0).toLocaleString()} items
        {catalog?.refreshedAt
          ? ` · updated ${new Date(catalog.refreshedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
          : ""}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- player ---- */


function StreamPlayer({
  title,
  group,
  source,
  credentials,
  live,
  onPrevious,
  onNext,
}: {
  title: string;
  group: string;
  source: string | null;
  credentials: Creds;
  live: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const prepareStream = useServerFn(prepareTvStream);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!source) {
      video.removeAttribute("src");
      video.load();
      setStatus("idle");
      return;
    }

    setStatus("loading");
    setProgress(0);
    setDuration(0);

    let destroyed = false;
    let cleanup: (() => void) | null = null;

    const detach = () => {
      cleanup?.();
      cleanup = null;
      video.removeAttribute("src");
      try {
        video.load();
      } catch {
        /* ignore */
      }
    };

    void (async () => {
      let prepared: Awaited<ReturnType<typeof prepareStream>>;
      try {
        prepared = await prepareStream({
          data: { url: source, username: credentials.username, password: credentials.password },
        });
      } catch {
        if (!destroyed) setStatus("error");
        return;
      }
      if (destroyed) return;

      const attempts: Array<{ url: string; kind: "hls" | "ts" | "file" }> = [
        { url: prepared.url, kind: prepared.kind },
        ...(prepared.fallbacks ?? []),
      ];

      const start = () => void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));

      /** Try one engine. Resolves false when it fails so the next can run. */
      const attempt = (entry: { url: string; kind: "hls" | "ts" | "file" }) =>
        new Promise<boolean>((resolve) => {
          let settled = false;
          const done = (ok: boolean) => {
            if (settled) return;
            settled = true;
            resolve(ok);
          };

          void (async () => {
            if (entry.kind === "hls") {
              const { default: Hls } = await import("hls.js");
              if (destroyed) return done(false);
              if (Hls.isSupported()) {
                const hls = new Hls({
                  enableWorker: true,
                  lowLatencyMode: false,
                  backBufferLength: 60,
                  maxBufferLength: 30,
                  manifestLoadingTimeOut: 20_000,
                  manifestLoadingMaxRetry: 3,
                  levelLoadingMaxRetry: 4,
                  fragLoadingMaxRetry: 6,
                });
                let recovered = 0;
                hls.loadSource(entry.url);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                  setStatus("ready");
                  start();
                  done(true);
                });
                hls.on(Hls.Events.ERROR, (_event, data) => {
                  if (!data.fatal) return;
                  if (data.type === Hls.ErrorTypes.NETWORK_ERROR && recovered < 3) {
                    recovered += 1;
                    hls.startLoad();
                    return;
                  }
                  if (data.type === Hls.ErrorTypes.MEDIA_ERROR && recovered < 3) {
                    recovered += 1;
                    hls.recoverMediaError();
                    return;
                  }
                  hls.destroy();
                  done(false);
                });
                cleanup = () => hls.destroy();
                return;
              }
              if (video.canPlayType("application/vnd.apple.mpegurl") !== "") {
                video.src = entry.url;
                video.onerror = () => done(false);
                video.onloadeddata = () => { setStatus("ready"); done(true); };
                start();
                return;
              }
              return done(false);
            }

            if (entry.kind === "ts") {
              const mpegts = (await import("mpegts.js")).default;
              if (destroyed) return done(false);
              const features = mpegts.getFeatureList();
              if (features.mseLivePlayback) {
                const player = mpegts.createPlayer(
                  {
                    type: "mpegts",
                    isLive: live,
                    url: entry.url,
                    cors: true,
                    hasAudio: true,
                    hasVideo: true,
                  },
                  {
                    enableWorker: false,
                    enableStashBuffer: !live,
                    stashInitialSize: live ? 128 : 384,
                    liveBufferLatencyChasing: live,
                    lazyLoad: !live,
                    autoCleanupSourceBuffer: true,
                    fixAudioTimestampGap: true,
                    reuseRedirectedURL: true,
                  },
                );
                player.attachMediaElement(video);
                player.on(mpegts.Events.ERROR, () => {
                  try {
                    player.destroy();
                  } catch {
                    /* ignore */
                  }
                  done(false);
                });
                player.on(mpegts.Events.MEDIA_INFO, () => { setStatus("ready"); done(true); });
                player.load();
                start();
                cleanup = () => {
                  try {
                    player.destroy();
                  } catch {
                    /* ignore */
                  }
                };
                return;
              }
              return done(false);
            }

            // Progressive file (mp4/mkv/webm) — let the browser handle it.
            video.src = entry.url;
            video.onerror = () => done(false);
            video.onloadeddata = () => { setStatus("ready"); done(true); };
            start();
          })();

          // Give each engine a fair window before moving on.
          window.setTimeout(() => done(false), 18_000);
        });

      for (const entry of attempts) {
        if (destroyed) return;
        const ok = await attempt(entry);
        if (destroyed) return;
        if (ok) return;
        detach();
      }

      if (!destroyed) setStatus("error");
    })();

    return () => {
      destroyed = true;
      cleanup?.();
      video.onerror = null;
      video.onloadeddata = null;
    };
  }, [credentials.password, credentials.username, live, prepareStream, source]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else {
      video.pause();
      setPlaying(false);
    }
  };

  return (
    <div ref={shellRef} className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          poster={tvHubCinematic}
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
          onPlay={() => { setPlaying(true); setStatus("ready"); }}
          onPause={() => setPlaying(false)}
          onWaiting={() => setStatus("loading")}
          onPlaying={() => setStatus("ready")}
          onError={() => setStatus("error")}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        />
        {status === "loading" && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </span>
        )}
        {status === "error" && (
          <p className="pointer-events-none absolute inset-x-4 top-4 rounded-lg border border-destructive/40 bg-background/90 p-3 text-center text-xs text-foreground">
            This stream would not play in the browser. Try another channel.
          </p>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-16 sm:p-4 sm:pt-24">
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary sm:text-xs">
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded bg-destructive px-2 py-0.5 text-destructive-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />Live
              </span>
            )}
            <span className="truncate">{group}</span>
          </div>
          <h2 className="mb-2.5 truncate font-display text-lg font-black text-white sm:mb-3 sm:text-2xl">{title}</h2>
          {!live && (
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(progress, duration || 0)}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (videoRef.current) videoRef.current.currentTime = next;
                setProgress(next);
              }}
              className="pointer-events-auto mb-1 h-6 w-full accent-primary"
              aria-label="Playback position"
            />
          )}
          <div className="pointer-events-auto flex min-w-0 items-center gap-0.5 sm:gap-2">
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10 hover:text-white sm:h-10 sm:w-10" onClick={onPrevious} aria-label="Previous"><ChevronLeft className="h-5 w-5" /></Button>
            <Button
              type="button"
              size="icon"
              onClick={toggle}
              aria-label={playing ? "Pause" : "Play"}
              className="h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-glow hover:bg-primary/90 sm:h-12 sm:w-12"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/10 hover:text-white sm:h-10 sm:w-10" onClick={onNext} aria-label="Next"><ChevronRight className="h-5 w-5" /></Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/10 hover:text-white sm:h-10 sm:w-10"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                if (videoRef.current) videoRef.current.muted = next;
              }}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const next = Number(e.target.value);
                setVolume(next);
                setMuted(next === 0);
                if (videoRef.current) {
                  videoRef.current.volume = next;
                  videoRef.current.muted = next === 0;
                }
              }}
              className="hidden w-24 accent-primary sm:block"
              aria-label="Volume"
            />
            {!live && (
              <span className="ml-1 shrink-0 text-[10px] tabular-nums text-white/70 sm:text-xs">{formatTime(progress)} / {formatTime(duration)}</span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-9 w-9 text-white hover:bg-white/10 hover:text-white sm:h-10 sm:w-10"
              aria-label="Enter fullscreen"
              onClick={() => void shellRef.current?.requestFullscreen?.()}
            >
              <Expand className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
