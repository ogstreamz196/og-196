import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Expand,
  Film,
  Heart,
  ListVideo,
  Loader2,
  LockKeyhole,
  MonitorPlay,
  Pause,
  Play,
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
import { loadTvHubPlaylist, TV_HUB_HOST, type TvChannel } from "@/lib/tv-hub.functions";

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
  subtitle: string;
  category: string;
  section: Section;
  source: string;
  logo?: string | null;
  live?: boolean;
  epg?: Array<{ time: string; title: string; description: string }>;
};

const DEMO_ITEMS: PlayItem[] = [
  {
    id: "og-live",
    title: "OG One",
    subtitle: "Live showcase",
    category: "Entertainment",
    section: "tv",
    live: true,
    source: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    epg: [
      { time: "Now", title: "Prime Time", description: "Music, culture and entertainment from the OG studio." },
      { time: "18:30", title: "Street Sessions", description: "Live performances and behind-the-scenes stories." },
    ],
  },
  {
    id: "news-24",
    title: "City 24",
    subtitle: "News & weather",
    category: "News",
    section: "tv",
    live: true,
    source: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    epg: [
      { time: "Now", title: "Evening Briefing", description: "Headlines, weather and the stories shaping the city." },
    ],
  },
  {
    id: "midnight-run",
    title: "Midnight Run",
    subtitle: "1h 42m · Action",
    category: "Action",
    section: "movies",
    source: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    id: "after-dark",
    title: "After Dark",
    subtitle: "S1 E1 · The Signal",
    category: "Thriller",
    section: "series",
    source: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  },
];

const SECTION_OPTIONS: Array<{ id: Section; label: string; icon: typeof Tv }> = [
  { id: "tv", label: "TV", icon: Tv },
  { id: "movies", label: "Movies", icon: Film },
  { id: "series", label: "Series", icon: ListVideo },
];

const MAX_VISIBLE = 200;

/** Live Xtream URLs end in .ts (not playable in a browser) — prefer the HLS variant. */
function toPlayableSource(url: string) {
  if (/\/live\/[^/]+\/[^/]+\/\d+\.ts$/i.test(url)) return url.replace(/\.ts$/i, ".m3u8");
  return url;
}

function toPlayItem(channel: TvChannel): PlayItem {
  return {
    id: channel.id,
    title: channel.title,
    subtitle: channel.group,
    category: channel.group,
    section: channel.section,
    source: toPlayableSource(channel.url),
    logo: channel.logo,
    live: channel.section === "tv",
  };
}

function TvHubPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const fetchPlaylist = useServerFn(loadTvHubPlaylist);

  const [items, setItems] = useState<PlayItem[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");

  const [section, setSection] = useState<Section>("tv");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [playbackError, setPlaybackError] = useState("");

  const list = items ?? [];

  const sectionItems = useMemo(() => list.filter((item) => item.section === section), [list, section]);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matched = normalized
      ? sectionItems.filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(normalized))
      : sectionItems;
    return matched.slice(0, MAX_VISIBLE);
  }, [query, sectionItems]);

  const selected = list.find((item) => item.id === selectedId) ?? null;

  // Attach hls.js for HLS sources that the browser cannot play natively.
  useEffect(() => {
    const video = videoRef.current;
    const source = selected?.source;
    if (!video || !source) return;
    setPlaybackError("");

    const isHls = /\.m3u8(\?|$)/i.test(source);
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    if (!isHls || nativeHls) {
      video.src = source;
      void video.play().catch(() => setPlaying(false));
      return;
    }

    let destroyed = false;
    let hls: { destroy: () => void } | null = null;

    void (async () => {
      const { default: Hls } = await import("hls.js");
      if (destroyed) return;
      if (!Hls.isSupported()) {
        video.src = source;
        return;
      }
      const instance = new Hls({ enableWorker: true });
      hls = instance;
      instance.loadSource(source);
      instance.attachMedia(video);
      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => setPlaying(false));
      });
      instance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setPlaybackError("This stream could not be played in the browser. Try another channel.");
        }
      });
    })();

    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [selected?.source]);

  const selectItem = (item: PlayItem) => {
    setSelectedId(item.id);
    setPlaying(true);
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const moveChannel = (direction: -1 | 1) => {
    if (sectionItems.length === 0) return;
    const currentIndex = sectionItems.findIndex((item) => item.id === selectedId);
    const nextIndex = (currentIndex + direction + sectionItems.length) % sectionItems.length;
    const next = sectionItems[nextIndex];
    if (next) selectItem(next);
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    return `${mins}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
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
      const mapped = playlist.channels.map(toPlayItem);
      setItems(mapped);
      setIsDemo(false);
      setPassword("");
      const firstSection = (["tv", "movies", "series"] as Section[]).find((s) =>
        mapped.some((item) => item.section === s),
      );
      if (firstSection) setSection(firstSection);
      const first = mapped.find((item) => item.section === (firstSection ?? "tv"));
      if (first) setSelectedId(first.id);
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
              Enter the username and password from your TV provider. Your details are used once to load your own
              playlist and are never saved. OG BOT does not host, store or supply any of the content you watch.
            </p>

            <form className="space-y-4" onSubmit={handleSignIn}>
              <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                <span className="font-bold text-foreground">Server</span>
                <span className="ml-2 break-all">{TV_HUB_HOST.replace(/^https?:\/\//, "")}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span>Username</span>
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    placeholder="Username"
                    className="h-11 bg-background/70"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span>Password</span>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Password"
                    className="h-11 bg-background/70"
                  />
                </label>
              </div>
              {loginMessage && (
                <p role="status" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
                  {loginMessage}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="submit" size="lg" className="h-12" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                  {loading ? "Loading playlist" : "Sign in"}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="h-12"
                  disabled={loading}
                  onClick={() => {
                    setItems(DEMO_ITEMS);
                    setIsDemo(true);
                    setSection("tv");
                    setSelectedId(DEMO_ITEMS[0].id);
                  }}
                >
                  <Play className="h-4 w-4" /> Temporary demo access
                </Button>
              </div>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-card sm:rounded-3xl">
      <header className="flex flex-col gap-4 border-b border-border bg-card/90 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><MonitorPlay className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-primary">{isDemo ? "Demo mode" : `${list.length} channels`}</p>
            <h1 className="font-display text-2xl font-black uppercase leading-none">TV HUB</h1>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search TV HUB" className="h-10 bg-background/70 pl-9" aria-label="Search TV HUB" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0"
            onClick={() => {
              setItems(null);
              setSelectedId(null);
              setQuery("");
              setIsDemo(false);
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
          <div ref={playerRef} className="group relative aspect-video overflow-hidden bg-background">
            <video
              ref={videoRef}
              poster={tvHubCinematic}
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => setPlaybackError("This stream could not be played in the browser. Try another channel.")}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
              onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
            />
            {playbackError && (
              <p className="absolute left-1/2 top-4 w-[90%] -translate-x-1/2 rounded-lg border border-destructive/40 bg-background/90 p-3 text-center text-xs text-foreground">
                {playbackError}
              </p>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-3 pt-12 sm:p-5 sm:pt-20">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-primary sm:text-xs">
                    {selected?.live && <span className="rounded bg-destructive px-2 py-0.5 text-destructive-foreground">Live</span>}
                    <span className="truncate">{selected?.category ?? ""}</span>
                  </div>
                  <h2 className="truncate font-display text-xl font-black sm:text-3xl">{selected?.title ?? "Choose a channel"}</h2>
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">{selected?.subtitle ?? ""}</p>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(progress, duration || 0)}
                onChange={(event) => {
                  const nextTime = Number(event.target.value);
                  if (videoRef.current) videoRef.current.currentTime = nextTime;
                  setProgress(nextTime);
                }}
                className="pointer-events-auto h-5 w-full accent-primary"
                aria-label="Playback position"
              />
              <div className="pointer-events-auto flex min-w-0 items-center gap-1 sm:gap-2">
                <Button type="button" variant="ghost" size="icon" onClick={() => moveChannel(-1)} aria-label="Previous channel"><ChevronLeft /></Button>
                <Button type="button" size="icon" onClick={togglePlayback} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause /> : <Play />}</Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => moveChannel(1)} aria-label="Next channel"><ChevronRight /></Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={muted ? "Unmute" : "Mute"}
                  onClick={() => {
                    const nextMuted = !muted;
                    setMuted(nextMuted);
                    if (videoRef.current) videoRef.current.muted = nextMuted;
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
                  onChange={(event) => {
                    const nextVolume = Number(event.target.value);
                    setVolume(nextVolume);
                    setMuted(nextVolume === 0);
                    if (videoRef.current) {
                      videoRef.current.volume = nextVolume;
                      videoRef.current.muted = nextVolume === 0;
                    }
                  }}
                  className="hidden w-24 accent-primary sm:block"
                  aria-label="Volume"
                />
                <span className="ml-1 text-[10px] tabular-nums text-muted-foreground sm:text-xs">{formatTime(progress)} / {formatTime(duration)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  aria-label="Enter fullscreen"
                  onClick={() => void playerRef.current?.requestFullscreen?.()}
                >
                  <Expand />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-1">
              {SECTION_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <Button
                    key={option.id}
                    type="button"
                    variant={section === option.id ? "default" : "ghost"}
                    className="min-w-0 px-2"
                    onClick={() => setSection(option.id)}
                  >
                    <Icon className="h-4 w-4" /><span className="truncate">{option.label}</span>
                  </Button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={`${section} selection`}>
              {visibleItems.map((item) => {
                const active = item.id === selectedId;
                const favourite = favourites.includes(item.id);
                return (
                  <article key={item.id} className={cn("min-w-0 rounded-lg border bg-card p-3 transition", active ? "border-primary shadow-glow" : "border-border hover:border-primary/50")}>
                    <div className="flex min-w-0 items-center gap-3">
                      <Button type="button" size="icon" variant={active ? "default" : "outline"} onClick={() => selectItem(item)} aria-label={`Play ${item.title}`}>
                        {active && playing ? <Pause /> : <Play />}
                      </Button>
                      <Button type="button" variant="ghost" className="h-auto min-w-0 flex-1 justify-start px-1 py-1 text-left" onClick={() => selectItem(item)}>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{item.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                        </span>
                      </Button>
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
                  </article>
                );
              })}
            </div>
            {visibleItems.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nothing here matches your search.</p>}
            {sectionItems.length > visibleItems.length && (
              <p className="pt-4 text-center text-xs text-muted-foreground">
                Showing {visibleItems.length} of {sectionItems.length} — search to narrow it down.
              </p>
            )}
          </div>
        </section>

        <aside className="min-w-0 bg-card/60 p-4 sm:p-5" aria-labelledby="guide-title">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-primary">Programme guide</p>
              <h2 id="guide-title" className="font-display text-xl font-black uppercase">Now & next</h2>
            </div>
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </div>
          {selected?.epg?.length ? (
            <ol className="space-y-2">
              {selected.epg.map((programme, index) => (
                <li key={`${programme.time}-${programme.title}`} className={cn("rounded-lg border p-3", index === 0 ? "border-primary bg-primary/10" : "border-border bg-background/30")}>
                  <div className="flex gap-3">
                    <span className="flex w-14 shrink-0 items-center gap-1 text-xs font-bold text-primary"><Clock3 className="h-3.5 w-3.5" />{programme.time}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{programme.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{programme.description}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background/30 p-6 text-center">
              <Clock3 className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-bold">Guide unavailable</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Your provider has not supplied programme data for this channel.</p>
            </div>
          )}
          <div className="mt-5 rounded-lg border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
            Channels, categories and streams come directly from your own provider account. OG BOT does not host, store
            or control any of this content and takes no responsibility for it.
          </div>
        </aside>
      </div>
    </main>
  );
}
