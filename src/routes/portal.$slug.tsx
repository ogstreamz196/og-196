import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Music2, Coins, Wand2, LogIn, AlertTriangle, Languages, Tags, FileText, Pencil, Music, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useSettings } from "@/hooks/use-settings";
import { SongCard, type Song } from "@/components/SongCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { computeWatch, DEFAULT_TIMEOUT_MS } from "@/lib/generation-watch";
import { EditableContent } from "@/components/admin/EditableContent";
import { SongStudioCoPilot } from "@/components/messenger/SongStudioCoPilot";

const LANGUAGE_OPTIONS = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Dutch", "Polish", "Russian", "Ukrainian", "Turkish", "Arabic",
  "Hindi", "Bengali", "Mandarin Chinese", "Cantonese", "Japanese",
  "Korean", "Vietnamese", "Thai", "Indonesian", "Filipino", "Swahili",
] as const;

const VOCAL_MOOD_POOL = [
  "dreamy", "gritty", "uplifting", "melancholic", "ethereal", "raspy",
  "soulful", "haunting", "playful", "intimate", "powerful", "whispery",
  "smooth", "raw", "angelic", "dark", "warm", "breathy", "anthemic",
  "sultry", "mellow", "fierce", "tender", "confident", "vulnerable",
  "hypnotic", "punchy", "airy", "sad", "euphoric", "hopeful", "nostalgic",
  "moody", "bright", "edgy", "cinematic", "romantic", "rebellious",
] as const;

const VISIBLE_BATCH = 8;

function pickBatch(pool: readonly string[], exclude: string[], size: number): string[] {
  const available = pool.filter((p) => !exclude.includes(p));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(size, shuffled.length));
}


interface Portal {
  id: string;
  slug: string;
  name: string;
  language: string;
  style_tags: string[];
  status: string;
  primary_color: string;
  custom_welcome_text: string | null;
  coin_cost_per_generation: number;
}

export const Route = createFileRoute("/portal/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("portals")
      .select("id, slug, name, language, style_tags, status, primary_color, custom_welcome_text, coin_cost_per_generation")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return { portal: data as Portal };
  },
  component: PortalPage,
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center bg-background p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Portal not found</h1>
        <p className="mt-2 text-muted-foreground">This portal doesn't exist or has been removed.</p>
        <Link to="/" className="mt-4 inline-block text-primary underline">Go home</Link>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="grid min-h-dvh place-items-center bg-background p-6 text-center">
      <p className="text-destructive">Something went wrong loading this portal.</p>
    </div>
  ),
});

function PortalPage() {
  const { portal } = Route.useLoaderData();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  // Portal coin override wins; fall back to global setting if unset.
  const COIN_COST = portal.coin_cost_per_generation ?? settings?.coins_per_generation ?? 3;
  const SONGS_PER_GEN = settings?.songs_per_generation ?? 2;
  const themeColor = portal.primary_color || "hsl(var(--primary))";

  const [songName, setSongName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [moodBatch, setMoodBatch] = useState<string[]>(() => pickBatch(VOCAL_MOOD_POOL, [], VISIBLE_BATCH));
  const [styleBatch, setStyleBatch] = useState<string[]>(() => pickBatch(portal.style_tags ?? [], [], VISIBLE_BATCH));
  const [lyrics, setLyrics] = useState("");
  const [language, setLanguage] = useState<string>(portal.language || "English");


  // Maintenance gate — friendly screen, no generation possible
  if (portal.status === "maintenance") {
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl" style={{ backgroundColor: themeColor }}>
            <Wand2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">{portal.name} is paused</h1>
          <p className="mt-2 text-muted-foreground">
            This portal is in maintenance mode. Please check back shortly — generation will be available again soon.
          </p>
          <Link to="/" className="mt-6 inline-block text-primary underline">Back to home</Link>
        </div>
      </div>
    );
  }

  function toggleTag(tag: string) {
    setSelectedTags((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]));
  }

  function pickStyle(tag: string) {
    setSelectedTags((p) => (p.includes(tag) ? p : [...p, tag]));
    setStyleBatch((batch) => {
      const exclude = [...batch, tag, ...selectedTags];
      const [replacement] = pickBatch(portal.style_tags ?? [], exclude, 1);
      return batch.map((t) => (t === tag ? (replacement ?? t) : t)).filter((t, i, arr) => arr.indexOf(t) === i);
    });
  }
  function unpickStyle(tag: string) {
    setSelectedTags((p) => p.filter((t) => t !== tag));
  }
  function refreshStyles() {
    setStyleBatch(pickBatch(portal.style_tags ?? [], selectedTags, VISIBLE_BATCH));
  }

  function pickMood(mood: string) {
    setSelectedMoods((p) => (p.includes(mood) ? p : [...p, mood]));
    setMoodBatch((batch) => {
      const exclude = [...batch, mood, ...selectedMoods];
      const [replacement] = pickBatch(VOCAL_MOOD_POOL, exclude, 1);
      return batch.map((t) => (t === mood ? (replacement ?? t) : t)).filter((t, i, arr) => arr.indexOf(t) === i);
    });
  }
  function unpickMood(mood: string) {
    setSelectedMoods((p) => p.filter((m) => m !== mood));
  }
  function refreshMoods() {
    setMoodBatch(pickBatch(VOCAL_MOOD_POOL, selectedMoods, VISIBLE_BATCH));
  }

  const portalSongsQuery = useQuery({
    queryKey: ["portal-songs", portal.id, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Song[]> => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, prompt, style, status, audio_path, sample_path, cover_url, duration_seconds, error_message, created_at, suno_task_id")
        .eq("portal_id", portal.id)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as Song[];
    },
  });

  // ---- Resilient watch for Suno generation (30–120s typical, 180s hard timeout) ----
  const [watchTaskId, setWatchTaskId] = useState<string | null>(null);
  const [watchStartedAt, setWatchStartedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // forces re-render so elapsed/timeout recompute
  const lastTerminalRef = useRef<string | null>(null);

  const watch = computeWatch({
    taskId: watchTaskId,
    startedAt: watchStartedAt,
    now: Date.now() + tick * 0, // tick is just a re-render signal
    songs: (portalSongsQuery.data ?? []).map((s: any) => ({
      suno_task_id: s.suno_task_id ?? null,
      status: s.status,
      error_message: s.error_message,
    })),
    expectedCount: SONGS_PER_GEN,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  const isWatching = watch.state === "watching";

  // Realtime subscription (primary) — keeps the song list in sync.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`portal-songs-${portal.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "songs", filter: `user_id=eq.${user.id}` },
        () => portalSongsQuery.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, portal.id]);

  // Polling fallback — realtime can drop on flaky networks. While watching, refetch every 5s and tick every 1s.
  useEffect(() => {
    if (!isWatching) return;
    const refetch = setInterval(() => portalSongsQuery.refetch(), 5_000);
    const ticker = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => { clearInterval(refetch); clearInterval(ticker); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWatching]);

  // Terminal transitions → toast + clear watch state once per task.
  useEffect(() => {
    if (!watchTaskId) return;
    if (watch.state === "completed" && lastTerminalRef.current !== watchTaskId) {
      lastTerminalRef.current = watchTaskId;
      toast.success(`Songs ready! ${watch.matched.length} variation${watch.matched.length === 1 ? "" : "s"} delivered.`);
      setWatchTaskId(null);
      setWatchStartedAt(null);
    } else if (watch.state === "failed" && lastTerminalRef.current !== watchTaskId) {
      lastTerminalRef.current = watchTaskId;
      toast.error(watch.errorMessage || "Generation failed. Coins refunded.");
      qc.invalidateQueries({ queryKey: ["profile"] });
      setWatchTaskId(null);
      setWatchStartedAt(null);
    } else if (watch.state === "timeout" && lastTerminalRef.current !== watchTaskId) {
      lastTerminalRef.current = watchTaskId;
      toast.error("Suno didn't respond in 3 minutes. If coins weren't refunded, contact support.");
      setWatchTaskId(null);
      setWatchStartedAt(null);
    }
  }, [watch.state, watchTaskId, watch.matched.length, watch.errorMessage, qc]);

  const generateLyrics = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-lyrics", {
        body: {
          songName,
          description,
          styleTags: selectedTags,
          language,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data.lyrics as string;
    },
    onSuccess: (text) => {
      setLyrics(text);
      toast.success(`Lyrics generated in ${language}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const generateSongs = useMutation({
    mutationFn: async () => {
      const vocalSuffix = selectedMoods.length ? ` Vocal: ${selectedMoods.join(", ")}.` : "";
      const styleString = [...selectedTags, ...selectedMoods.map((m) => `${m} vocals`)].join(", ");
      const { data, error } = await supabase.functions.invoke("suno-generate", {
        body: {
          prompt: (description || songName) + vocalSuffix,
          style: styleString,
          title: songName,
          lyrics,
          portal_id: portal.id,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { song_id: string; task_id: string | null; coin_balance: number };
    },
    onSuccess: (data) => {
      toast.success(`Queued ${SONGS_PER_GEN} songs — they'll appear below shortly`);
      if (data.task_id) {
        lastTerminalRef.current = null;
        setWatchTaskId(data.task_id);
        setWatchStartedAt(Date.now());
      }
      qc.invalidateQueries({ queryKey: ["portal-songs"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => {
      const msg = e.message?.toLowerCase() ?? "";
      if (msg.includes("insufficient")) {
        toast.error("Not enough coins — visit Buy Coins.");
      } else if (msg.includes("maintenance")) {
        toast.error("This portal is in maintenance mode.");
      } else {
        toast.error(e.message || "Generation failed");
      }
    },
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Music2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">Sonix</span>
        </Link>
        {user ? (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
            <Coins className="h-4 w-4 text-coin" />
            <span className="font-semibold">{profile?.coin_balance ?? 0}</span>
            <span className="text-muted-foreground">coins</span>
          </div>
        ) : (
          <Link to="/auth">
            <Button size="sm" variant="outline"><LogIn className="mr-2 h-4 w-4" /> Sign in</Button>
          </Link>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-2 py-10 sm:px-4 sm:py-14">
        <div
          className="landing-card relative overflow-hidden border-2"
          style={{ borderColor: themeColor, boxShadow: `0 0 60px -20px ${themeColor}` }}
        >
          <div
            className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-3 py-1 text-sm backdrop-blur"
            style={{ borderColor: themeColor, color: themeColor }}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Portal · Lyrics in {language}
          </div>

          <h1 className="font-display mt-4 text-[clamp(2.25rem,9vw,5.5rem)] font-black leading-[0.95] tracking-[-0.03em]">{portal.name}</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            <EditableContent
              contentKey="portal.subtitle"
              defaultValue="Write your song idea below, generate lyrics for free, then turn them into music."
              multiline
            />
          </p>
          {portal.custom_welcome_text && (
            <div
              className="mt-4 rounded-2xl border bg-background/40 p-4 text-base"
              style={{ borderColor: themeColor }}
            >
              {portal.custom_welcome_text}
            </div>
          )}
        </div>

        <div className="landing-card landing-grid">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <EditableContent contentKey="portal.step1.heading" defaultValue="Describe your song" />
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="song-name" className="flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Song name
              </Label>
              <Input
                id="song-name"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                placeholder="My Brand New Song"
                maxLength={200}
                className="mt-2"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="description" className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Describe the lyrics
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A love story set on a rainy night in the city..."
                rows={3}
                maxLength={1000}
                className="mt-2 resize-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">{description.length}/1000 characters</p>
            </div>

            <div>
              <Label htmlFor="language" className="flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5 text-muted-foreground" /> Lyrics language
              </Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language" className="mt-2">
                  <SelectValue placeholder="Choose a language" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <Label className="flex flex-wrap items-center gap-1.5">
                  <Music className="h-3.5 w-3.5 text-muted-foreground" /> Vocal mood
                  {selectedMoods.map((mood) => (
                    <span
                      key={mood}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      {mood}
                      <button type="button" onClick={() => unpickMood(mood)} aria-label={`Remove ${mood}`} className="opacity-80 hover:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </Label>
                <button
                  type="button"
                  onClick={refreshMoods}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  aria-label="Shuffle vocal moods"
                >
                  <RefreshCw className="h-3 w-3" /> Shuffle
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {moodBatch.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => pickMood(mood)}
                    className="rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="flex flex-wrap items-center gap-1.5">
                <Tags className="h-3.5 w-3.5 text-muted-foreground" /> Style tags
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    {tag}
                    <button type="button" onClick={() => unpickStyle(tag)} aria-label={`Remove ${tag}`} className="opacity-80 hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </Label>
              {(portal.style_tags?.length ?? 0) > VISIBLE_BATCH && (
                <button
                  type="button"
                  onClick={refreshStyles}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  aria-label="Shuffle style tags"
                >
                  <RefreshCw className="h-3 w-3" /> Shuffle
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {styleBatch.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => pickStyle(tag)}
                  className="rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-border pb-3 pt-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <EditableContent contentKey="portal.step2.heading" defaultValue="Write the lyrics" />
            </h2>
          </div>

          <Button
            variant="outline"
            onClick={() => generateLyrics.mutate()}
            disabled={generateLyrics.isPending || (!songName.trim() && !description.trim())}
          >
            {generateLyrics.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Writing in {language}...</>
              : lyrics
                ? <><Wand2 className="mr-2 h-4 w-4" /> Regenerate Lyrics Draft (free)</>
                : <><Wand2 className="mr-2 h-4 w-4" /> Generate Lyrics Draft in {language} (free)</>}
          </Button>


          {lyrics && (
            <div>
              <Label htmlFor="lyrics">Lyrics ({language})</Label>
              <Textarea
                id="lyrics"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={10}
                className="mt-2 resize-none font-mono text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-border pb-3 pt-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Generate music</h2>
          </div>

          <div className="pt-1">

            {user ? (
              <>
                <Button
                  size="lg"
                  onClick={() => generateSongs.mutate()}
                  disabled={
                    generateSongs.isPending ||
                    isWatching ||
                    !lyrics.trim() ||
                    (profile?.coin_balance ?? 0) < COIN_COST
                  }
                  className="w-full text-white shadow-glow hover:opacity-90"
                  style={{ backgroundColor: themeColor }}
                >
                  {generateSongs.isPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending to Suno...</>
                    : isWatching
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating · {Math.floor(watch.elapsedMs / 1000)}s elapsed</>
                      : (portalSongsQuery.data && portalSongsQuery.data.length > 0)
                        ? <><Sparkles className="mr-2 h-4 w-4" /> Regenerate Song Tracks ({COIN_COST} coins)</>
                        : <><Sparkles className="mr-2 h-4 w-4" /> Generate Song Tracks · {SONGS_PER_GEN} variations ({COIN_COST} coins)</>}
                </Button>
                {isWatching && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                    <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                    <span>
                      Suno typically takes 30–120 seconds. We'll auto-update when it's ready.
                      If nothing arrives in 3 minutes, your coins are refunded.
                    </span>
                  </div>
                )}
                {watch.state === "timeout" && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Generation timed out. Try again — and let us know if it keeps happening.</span>
                  </div>
                )}
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Each regeneration costs {COIN_COST} coins. Downloads of generated tracks are free.
                </p>
                {(profile?.coin_balance ?? 0) < COIN_COST && (
                  <p className="mt-2 text-center text-sm text-destructive">
                    You need {COIN_COST - (profile?.coin_balance ?? 0)} more coin(s).{" "}
                    <Link to="/buy-coins" className="underline">Buy more</Link>.
                  </p>
                )}
              </>
            ) : (
              <Link to="/auth">
                <Button size="lg" className="w-full bg-gradient-brand text-primary-foreground">
                  <LogIn className="mr-2 h-4 w-4" /> Sign in to generate songs
                </Button>
              </Link>
            )}
          </div>
        </div>

        {user && (
          <div>
            <h2 className="mb-5 flex items-center gap-2 text-lg uppercase tracking-[0.28em] text-muted-foreground sm:text-xl">
              <Music2 className="h-5 w-5 text-primary" /> Your tracks from this portal
            </h2>
            {portalSongsQuery.isLoading ? (
              <div className="grid place-items-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : portalSongsQuery.data && portalSongsQuery.data.length > 0 ? (
              <div className="grid gap-4">
                {portalSongsQuery.data.map((s) => <SongCard key={s.id} song={s} />)}
              </div>
            ) : (
              <div className="rounded-[2rem] border-2 border-dashed border-white/15 bg-card/50 p-10 text-center text-lg text-muted-foreground">
                Nothing yet — generate your first track above.
              </div>
            )}
          </div>
        )}
      </main>
      {portal.slug === "song-studio" && <SongStudioCoPilot />}
      {portal.slug === "song-studio" && user && (profile?.coin_balance ?? 0) <= 0 && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/55 p-6 text-center shadow-glow backdrop-blur-lg">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
              <Coins className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-white">You're out of fuel.</h3>
            <p className="mt-2 text-sm text-white/70">
              Head to the Dashboard or call the Boss to top up your balance.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link to="/buy-coins">
                <Button size="sm" className="w-full bg-gradient-brand text-primary-foreground sm:w-auto">
                  <Coins className="mr-2 h-4 w-4" /> Top up balance
                </Button>
              </Link>
              <Link to="/">
                <Button size="sm" variant="outline" className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 sm:w-auto">
                  Back to dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
