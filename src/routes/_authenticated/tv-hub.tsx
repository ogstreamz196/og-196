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
  loadTvHubPlaylist,
  prepareTvStream,
  TV_HUB_HOST,
  type TvAccount,
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

type PlayItem = {
  id: string;
  title: string;
  group: string;
  section: Section;
  source: string;
  logo?: string | null;
};


const SECTIONS: Array<{ id: Section; label: string; caption: string; icon: typeof Tv }> = [
  { id: "tv", label: "Live TV", caption: "Channels & sport", icon: Radio },
  { id: "movies", label: "Movies", caption: "Films on demand", icon: Film },
  { id: "series", label: "Series", caption: "Box sets & shows", icon: ListVideo },
];

const PAGE_SIZE = 300;

function formatExpiry(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const label = date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  if (days < 0) return { label, note: "Expired", expired: true };
  return { label, note: days === 0 ? "Expires today" : `${days} day${days === 1 ? "" : "s"} left`, expired: false };
}

function toPlayItem(channel: TvChannel): PlayItem {
  return {
    id: channel.id,
    title: channel.title,
    group: channel.group,
    section: channel.section,
    source: channel.url,
    logo: channel.logo,
  };
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  return `${mins}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function TvHubPage() {
  const fetchPlaylist = useServerFn(loadTvHubPlaylist);

  const [items, setItems] = useState<PlayItem[] | null>(null);
  const [account, setAccount] = useState<TvAccount | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");

  const [section, setSection] = useState<Section | null>(null);
  const [group, setGroup] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favourites, setFavourites] = useState<string[]>([]);

  const list = items ?? [];

  const sectionItems = useMemo(
    () => (section ? list.filter((item) => item.section === section) : []),
    [list, section],
  );

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of sectionItems) counts.set(item.group, (counts.get(item.group) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sectionItems]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sectionItems.filter(
      (item) =>
        (group === "All" || item.group === group) &&
        (!normalized || item.title.toLowerCase().includes(normalized)),
    );
  }, [group, query, sectionItems]);

  const visible = filtered.slice(0, visibleCount);
  const selected = list.find((item) => item.id === selectedId) ?? null;
  const expiry = formatExpiry(account?.expiresAt ?? null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [group, query, section]);

  const openSection = (next: Section) => {
    setSection(next);
    setGroup("All");
    setQuery("");
    const first = list.find((item) => item.section === next);
    setSelectedId(first?.id ?? null);
  };

  const step = (direction: -1 | 1) => {
    if (filtered.length === 0) return;
    const index = filtered.findIndex((item) => item.id === selectedId);
    const next = filtered[(index + direction + filtered.length) % filtered.length];
    if (next) setSelectedId(next.id);
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setLoginMessage("Enter your username and password.");
      return;
    }
    setLoading(true);
    setLoginMessage("");
    try {
      const playlist = await fetchPlaylist({ data: { username: username.trim(), password } });
      setItems(playlist.channels.map(toPlayItem));
      setAccount(playlist.account);
      setTruncated(playlist.truncated);


      setPassword("");
      setSection(null);
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------------- login */
  if (!items) {
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
          <section className="w-full max-w-xl rounded-xl border border-border bg-card/95 p-5 shadow-card backdrop-blur-xl sm:p-8" aria-labelledby="tv-login-title">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow">
                <MonitorPlay className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-primary">OG BOT Entertainment</p>
                <h1 id="tv-login-title" className="font-display text-3xl font-black uppercase leading-none sm:text-5xl">TV HUB</h1>
              </div>
            </div>

            <p className="mb-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Enter the username and password from your TV provider. Your details load your own playlist and are never
              saved. OG BOT does not host, store or control any of the content you watch.
            </p>

            <form className="space-y-4" onSubmit={handleSignIn}>
              <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                <span className="font-bold text-foreground">Server</span>
                <span className="ml-2 break-all">{TV_HUB_HOST.replace(/^https?:\/\//, "")}</span>
              </div>
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
                {loading ? "Loading your channels" : "Sign in"}
              </Button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  const counts: Record<Section, number> = {
    tv: list.filter((i) => i.section === "tv").length,
    movies: list.filter((i) => i.section === "movies").length,
    series: list.filter((i) => i.section === "series").length,
  };

  const signOut = () => {
    setItems(null);
    setAccount(null);
    setTruncated(false);
    setSection(null);
    setSelectedId(null);
    setQuery("");
    setGroup("All");
  };

  /* ------------------------------------------------------------ dashboard */
  if (!section) {
    return (
      <main className="relative isolate min-h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-card sm:rounded-3xl">
        <img src={tvHubCinematic} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface/80 via-surface/95 to-surface" />
        <div className="relative flex min-h-[calc(100dvh-7rem)] flex-col p-4 sm:p-8">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow"><MonitorPlay className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{`${list.length} items loaded`}</p>
                <h1 className="font-display text-2xl font-black uppercase leading-none sm:text-3xl">TV HUB</h1>
              </div>
            </div>
            <Button type="button" variant="outline" className="h-10" onClick={signOut}>Sign out</Button>
          </header>

          <AccountBar account={account} expiry={expiry} total={list.length} truncated={truncated} />



          <div className="grid flex-1 content-center gap-4 sm:grid-cols-3">
            {SECTIONS.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => openSection(entry.id)}
                  className="group relative min-h-40 overflow-hidden rounded-2xl border border-border bg-card/80 p-5 text-left transition hover:border-primary hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-56 sm:p-6"
                >
                  <span className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/25" />
                  <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Icon className="h-6 w-6" /></span>
                  <span className="relative mt-4 block font-display text-2xl font-black uppercase leading-none sm:mt-8 sm:text-3xl">{entry.label}</span>
                  <span className="relative mt-2 block text-sm text-muted-foreground">{entry.caption}</span>
                  <span className="relative mt-3 block text-xs font-bold uppercase tracking-wide text-primary">{counts[entry.id]} available</span>
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

  return (
    <main className="flex min-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card sm:rounded-3xl">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card/90 p-3 backdrop-blur-xl sm:gap-3 sm:p-4">
        <Button type="button" variant="ghost" size="icon" aria-label="Back to TV HUB menu" onClick={() => setSection(null)}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">TV HUB</p>
          <h1 className="truncate font-display text-xl font-black uppercase leading-none">{activeSection.label}</h1>
        </div>
        <div className="relative order-last w-full sm:order-none sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${activeSection.label}`} className="h-10 bg-background/70 pl-9" aria-label={`Search ${activeSection.label}`} />
        </div>
        <Button type="button" variant="outline" className="h-10 shrink-0" onClick={signOut}>Sign out</Button>
      </header>

      <div className="grid min-w-0 flex-1 lg:grid-cols-[14rem_18rem_minmax(0,1fr)]">
        {/* categories */}
        <nav className="min-w-0 border-b border-border bg-card/60 p-2 lg:border-b-0 lg:border-r" aria-label="Categories">
          <div className="flex gap-2 overflow-x-auto lg:max-h-[60vh] lg:flex-col lg:overflow-y-auto">
            <Button
              type="button"
              variant={group === "All" ? "default" : "ghost"}
              className="h-9 shrink-0 justify-start gap-2 px-3"
              onClick={() => setGroup("All")}
            >
              <LayoutGrid className="h-4 w-4" /><span className="truncate">All</span>
              <span className="ml-auto hidden text-xs opacity-70 lg:inline">{sectionItems.length}</span>
            </Button>
            {groups.map(([name, count]) => (
              <Button
                key={name}
                type="button"
                variant={group === name ? "default" : "ghost"}
                className="h-9 shrink-0 justify-start px-3"
                onClick={() => setGroup(name)}
              >
                <span className="truncate">{name}</span>
                <span className="ml-auto hidden text-xs opacity-70 lg:inline">{count}</span>
              </Button>
            ))}
          </div>
        </nav>

        {/* channel list */}
        <section className="min-w-0 border-b border-border bg-background/30 p-2 lg:border-b-0 lg:border-r" aria-label={`${activeSection.label} list`}>
          <div className="max-h-[45vh] space-y-1 overflow-y-auto lg:max-h-[60vh]">
            {visible.map((item) => {
              const active = item.id === selectedId;
              const favourite = favourites.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 transition",
                    active ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-card",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
                  >
                    {item.logo ? (
                      <img src={item.logo} alt="" aria-hidden loading="lazy" className="h-8 w-8 shrink-0 rounded bg-background object-contain" />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-background text-muted-foreground"><Tv className="h-4 w-4" /></span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{item.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{item.group}</span>
                    </span>
                  </button>
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
                </div>
              );
            })}
            {visible.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nothing here matches your search.</p>}
            {filtered.length > visible.length && (
              <div className="p-3 text-center">
                <p className="mb-2 text-xs text-muted-foreground">Showing {visible.length} of {filtered.length}</p>
                <Button type="button" variant="outline" className="h-9 w-full" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  Show more
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* player */}
        <section className="min-w-0 p-3 sm:p-4" aria-label="Player">
          <StreamPlayer
            title={selected?.title ?? "Choose something to watch"}
            group={selected?.group ?? ""}
            source={selected?.source ?? null}
            live={section === "tv"}
            onPrevious={() => step(-1)}
            onNext={() => step(1)}
          />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Streams come directly from your provider account. OG BOT does not host, store or control this content.
          </p>
        </section>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------- player ---- */

function StreamPlayer({
  title,
  group,
  source,
  live,
  onPrevious,
  onNext,
}: {
  title: string;
  group: string;
  source: string | null;
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
      setStatus("idle");
      return;
    }

    setStatus("loading");
    setProgress(0);
    setDuration(0);

    let destroyed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      let prepared: { url: string; kind: "hls" | "ts" | "file" };
      try {
        prepared = await prepareStream({ data: { url: source } });
      } catch {
        if (!destroyed) setStatus("error");
        return;
      }
      if (destroyed) return;

      const start = () => void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));

      if (prepared.kind === "hls") {
        const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";
        const { default: Hls } = await import("hls.js");
        if (destroyed) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(prepared.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => { setStatus("ready"); start(); });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else setStatus("error");
          });
          cleanup = () => hls.destroy();
          return;
        }
        if (nativeHls) {
          video.src = prepared.url;
          start();
          return;
        }
        setStatus("error");
        return;
      }

      if (prepared.kind === "ts") {
        const mpegts = (await import("mpegts.js")).default;
        if (destroyed) return;
        if (mpegts.getFeatureList().mseLivePlayback) {
          const player = mpegts.createPlayer(
            { type: "mpegts", isLive: live, url: prepared.url },
            { enableStashBuffer: false, liveBufferLatencyChasing: true },
          );
          player.attachMediaElement(video);
          player.load();
          player.on(mpegts.Events.ERROR, () => setStatus("error"));
          start();
          cleanup = () => {
            player.destroy();
          };
          return;
        }
      }

      video.src = prepared.url;
      start();
    })();

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, [live, prepareStream, source]);

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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 to-transparent p-3 pt-14 sm:p-4 sm:pt-20">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-primary sm:text-xs">
            {live && <span className="rounded bg-destructive px-2 py-0.5 text-destructive-foreground">Live</span>}
            <span className="truncate">{group}</span>
          </div>
          <h2 className="mb-2 truncate font-display text-lg font-black text-white sm:text-2xl">{title}</h2>
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
              className="pointer-events-auto h-5 w-full accent-primary"
              aria-label="Playback position"
            />
          )}
          <div className="pointer-events-auto flex min-w-0 items-center gap-1 sm:gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={onPrevious} aria-label="Previous"><ChevronLeft /></Button>
            <Button type="button" size="icon" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause /> : <Play />}</Button>
            <Button type="button" variant="ghost" size="icon" onClick={onNext} aria-label="Next"><ChevronRight /></Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                if (videoRef.current) videoRef.current.muted = next;
              }}
            >
              {muted ? <VolumeX /> : <Volume2 />}
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
              <span className="ml-1 text-[10px] tabular-nums text-white/70 sm:text-xs">{formatTime(progress)} / {formatTime(duration)}</span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto"
              aria-label="Enter fullscreen"
              onClick={() => void shellRef.current?.requestFullscreen?.()}
            >
              <Expand />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
