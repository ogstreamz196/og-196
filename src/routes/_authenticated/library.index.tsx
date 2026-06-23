import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Library as LibraryIcon,
  Sparkles,
  RefreshCw,
  Wand2,
  Coins,
  Trash2,
  Languages,
  Disc3,
  Smile,
  Heart,
  Gauge,
  Mic2,
  Music4,
  Shuffle,
  MessageCircleHeart,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDevMode } from "@/hooks/use-dev-mode";
import { useRole } from "@/hooks/use-role";
import { useProfile } from "@/hooks/use-profile";
import { useSettings } from "@/hooks/use-settings";
import { invokeError } from "@/lib/invoke-error";
import { cn } from "@/lib/utils";
import { SongCard, type Song } from "@/components/SongCard";
import { OgInterviewDialog, type InterviewTurn } from "@/components/library/OgInterviewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/library/")({
  component: LibraryPage,
});

type Category = "language" | "genre" | "mood" | "theme" | "tempo";

const POOLS: Record<Category, string[]> = {
  language: [
    "English", "Spanish", "French", "German", "Italian", "Portuguese",
    "Japanese", "Korean", "Mandarin", "Hindi", "Arabic", "Swahili",
    "Yoruba", "Russian", "Turkish", "Punjabi", "Dutch", "Greek",
  ],
  genre: [
    "Drill", "Trap", "Afrobeats", "R&B", "Pop", "Dance", "Reggae",
    "Rock", "Indie", "House", "Lo-fi", "Country", "Jazz", "Funk",
    "Hyperpop", "Amapiano", "Dancehall", "Latin Trap", "Garage", "Bossa Nova",
  ],
  mood: [
    "Happy", "Sad", "Angry", "Romantic", "Hype", "Chill", "Melancholy",
    "Confident", "Heartbroken", "Nostalgic", "Playful", "Dark",
    "Hopeful", "Triumphant", "Dreamy", "Rebellious", "Bittersweet",
  ],
  theme: [
    "Love", "Heartbreak", "Money", "Party", "Family", "Revenge",
    "Friendship", "Hustle", "Loss", "Self-belief", "Summer nights",
    "City lights", "Late-night drive", "First crush", "Coming home",
    "Underdog story", "Toxic ex", "Glow-up",
  ],
  tempo: [
    "Slow burn", "Mid-tempo", "Upbeat", "Hype", "Floor-filler",
    "Chill groove", "Marching", "Bouncy", "Half-time", "Frenetic",
  ],
};

const META: Record<
  Category,
  {
    label: string;
    helper: string;
    placeholder: string;
    icon: typeof Languages;
    gradient: string;
    emoji: string;
    accent: string; // tailwind text/border accent class fragment
    chipActive: string;
    iconBg: string;
  }
> = {
  language: {
    label: "Language",
    helper: "What language do you want to sing in?",
    placeholder: "Pick a language",
    icon: Languages,
    gradient: "from-sky-500/50 via-cyan-500/25 to-transparent",
    emoji: "🌍",
    accent: "text-sky-300",
    chipActive: "border-sky-400 bg-sky-500/25 text-sky-100 shadow-[0_0_24px_-6px_theme(colors.sky.400)]",
    iconBg: "bg-sky-500/20 text-sky-300 border-sky-400/30",
  },
  genre: {
    label: "Genre",
    helper: "What sound are we cooking?",
    placeholder: "Pick a genre",
    icon: Disc3,
    gradient: "from-fuchsia-500/50 via-purple-500/25 to-transparent",
    emoji: "🎧",
    accent: "text-fuchsia-300",
    chipActive: "border-fuchsia-400 bg-fuchsia-500/25 text-fuchsia-100 shadow-[0_0_24px_-6px_theme(colors.fuchsia.400)]",
    iconBg: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30",
  },
  mood: {
    label: "Mood",
    helper: "How should it feel?",
    placeholder: "Pick a mood",
    icon: Smile,
    gradient: "from-amber-500/50 via-orange-500/25 to-transparent",
    emoji: "✨",
    accent: "text-amber-300",
    chipActive: "border-amber-400 bg-amber-500/25 text-amber-100 shadow-[0_0_24px_-6px_theme(colors.amber.400)]",
    iconBg: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  },
  theme: {
    label: "Theme",
    helper: "What's the song about?",
    placeholder: "Pick a theme",
    icon: Heart,
    gradient: "from-rose-500/50 via-pink-500/25 to-transparent",
    emoji: "💭",
    accent: "text-rose-300",
    chipActive: "border-rose-400 bg-rose-500/25 text-rose-100 shadow-[0_0_24px_-6px_theme(colors.rose.400)]",
    iconBg: "bg-rose-500/20 text-rose-300 border-rose-400/30",
  },
  tempo: {
    label: "Tempo",
    helper: "How fast should it hit?",
    placeholder: "Pick a tempo",
    icon: Gauge,
    gradient: "from-emerald-500/50 via-teal-500/25 to-transparent",
    emoji: "⚡",
    accent: "text-emerald-300",
    chipActive: "border-emerald-400 bg-emerald-500/25 text-emerald-100 shadow-[0_0_24px_-6px_theme(colors.emerald.400)]",
    iconBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  },
};

const GENRE_MOOD_BIAS: Record<string, string[]> = {
  Drill: ["Dark", "Angry", "Confident", "Rebellious"],
  Trap: ["Hype", "Confident", "Dark", "Triumphant"],
  Afrobeats: ["Happy", "Hype", "Romantic", "Playful"],
  "R&B": ["Romantic", "Heartbroken", "Bittersweet", "Dreamy"],
  Pop: ["Happy", "Hopeful", "Playful", "Triumphant"],
  Dance: ["Hype", "Happy", "Triumphant"],
  "Lo-fi": ["Chill", "Nostalgic", "Dreamy", "Melancholy"],
  Country: ["Nostalgic", "Hopeful", "Bittersweet"],
  Reggae: ["Chill", "Hopeful", "Playful"],
  Jazz: ["Romantic", "Melancholy", "Dreamy"],
  Amapiano: ["Hype", "Happy", "Confident"],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickFresh(
  cat: Category,
  exclude: Set<string>,
  count: number,
  context: Partial<Record<Category, string>> = {},
): string[] {
  const pool = POOLS[cat].filter((v) => !exclude.has(v));
  if (pool.length === 0) return [];
  if (cat === "mood" && context.genre && GENRE_MOOD_BIAS[context.genre]) {
    const preferred = GENRE_MOOD_BIAS[context.genre].filter((v) => !exclude.has(v));
    const rest = pool.filter((v) => !preferred.includes(v));
    return [...shuffle(preferred), ...shuffle(rest)].slice(0, count);
  }
  return shuffle(pool).slice(0, count);
}

type Selections = Partial<Record<Category, string>>;

function initialChips(): Record<Category, string[]> {
  return {
    language: pickFresh("language", new Set(), 4),
    genre: pickFresh("genre", new Set(), 4),
    mood: pickFresh("mood", new Set(), 4),
    theme: pickFresh("theme", new Set(), 4),
    tempo: pickFresh("tempo", new Set(), 4),
  };
}

function LibraryPage() {
  const { user } = useAuth();
  const dev = useDevMode();
  const { isAdmin } = useRole();
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const navigate = useNavigate();

  const lyricsCost = settings?.coins_per_lyrics_generation ?? 1;
  const previewCost = settings?.coins_per_generation ?? 3;
  // download cost is configured via settings.coins_per_full_unlock when needed
  const balance = profile?.coin_balance ?? 0;
  const firstName = useMemo(() => {
    if (dev.isDev) return "Developer";
    const raw = profile?.display_name?.trim() || user?.email?.split("@")[0] || "";
    return raw.split(/\s|\./)[0] || "there";
  }, [profile?.display_name, user?.email, dev.isDev]);

  const [title, setTitle] = useState("");
  const [selections, setSelections] = useState<Selections>({});
  const [chips, setChips] = useState<Record<Category, string[]>>(() => initialChips());
  const [categoryNotes, setCategoryNotes] = useState<Record<Category, string>>({
    language: "",
    genre: "",
    mood: "",
    theme: "",
    tempo: "",
  });
  const [lyrics, setLyrics] = useState("");
  const [genLyrics, setGenLyrics] = useState(false);
  const [foulMouth, setFoulMouth] = useState(false);
  const [personalDetails, setPersonalDetails] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [genSong, setGenSong] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewTranscript, setInterviewTranscript] = useState<InterviewTurn[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  function setField(cat: Category, value: string) {
    setSelections((prev) => ({ ...prev, [cat]: value }));
  }

  function refreshRow(cat: Category) {
    const exclude = new Set<string>([selections[cat] ?? ""].filter(Boolean));
    setChips((prev) => ({ ...prev, [cat]: pickFresh(cat, exclude, 4, selections) }));
  }

  function pickChip(cat: Category, value: string) {
    setField(cat, value);
    setChips((prev) => {
      const ctx: Selections = { ...selections, [cat]: value };
      const used = new Set<string>([...prev[cat], value].filter(Boolean));
      const replacement = pickFresh(cat, used, 1, ctx)[0];
      return {
        ...prev,
        [cat]: prev[cat].map((c) => (c === value ? replacement ?? c : c)),
      };
    });
  }

  const styleTags = useMemo(
    () => [selections.genre, selections.tempo].filter(Boolean) as string[],
    [selections.genre, selections.tempo],
  );

  const filledExtras =
    (selections.genre ? 1 : 0) +
    (selections.mood ? 1 : 0) +
    (selections.theme ? 1 : 0) +
    (selections.tempo ? 1 : 0);

  const totalFilled =
    (title.trim() ? 1 : 0) + (selections.language ? 1 : 0) + filledExtras;
  const progress = Math.min(100, Math.round((totalFilled / 6) * 100));

  const canGenerateLyrics =
    !!title.trim() && !!selections.language && filledExtras >= 1 && balance >= lyricsCost;

  async function generateLyrics() {
    if (!canGenerateLyrics) return;
    setGenLyrics(true);
    try {
      const noteParts = (["language", "genre", "mood", "theme", "tempo"] as Category[])
        .map((c) => {
          const n = categoryNotes[c]?.trim();
          return n ? `${META[c].label} notes: ${n}` : null;
        })
        .filter(Boolean) as string[];
      const description = [
        selections.theme ? `Theme: ${selections.theme}` : null,
        selections.mood ? `Mood: ${selections.mood}` : null,
        selections.tempo ? `Tempo: ${selections.tempo}` : null,
        ...noteParts,
      ]
        .filter(Boolean)
        .join(" · ");
      const combinedExtra = [extraContext.trim(), ...noteParts].filter(Boolean).join("\n");
      const { data, error } = await supabase.functions.invoke("generate-lyrics", {
        body: {
          songName: title.trim(),
          description,
          styleTags,
          language: selections.language,
          foulMouth,
          personalDetails: personalDetails.trim() || undefined,
          extraContext: combinedExtra || undefined,
        },
      });
      if (error) {
        const msg = invokeError(error, "Lyrics generation failed");
        toast.error(
          msg.toLowerCase().includes("insufficient")
            ? `Not enough coins (need ${lyricsCost})`
            : msg,
        );
        return;
      }
      const next = (data?.lyrics ?? "").toString();
      if (!next) {
        toast.error("No lyrics returned");
        return;
      }
      setLyrics(next);
      toast.success(`Lyrics ready · -${data?.coin_cost ?? lyricsCost} coins`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lyrics generation failed");
    } finally {
      setGenLyrics(false);
    }
  }

  async function generateSong() {
    if (!user) return;
    if (!lyrics.trim()) {
      toast.error("Generate lyrics first");
      return;
    }
    if (balance < previewCost) {
      toast.error(`Need ${previewCost} coins to generate a song`);
      return;
    }
    setGenSong(true);
    try {
      const cats: Category[] = ["language", "genre", "mood", "theme", "tempo"];
      const noteParts = cats
        .map((c) => {
          const n = categoryNotes[c]?.trim();
          return n ? `${META[c].label} notes: ${n}` : null;
        })
        .filter(Boolean) as string[];
      const styleNoteParts = (["genre", "mood", "tempo"] as Category[])
        .map((c) => categoryNotes[c]?.trim())
        .filter(Boolean) as string[];
      const style = [selections.genre, selections.mood, selections.tempo, ...styleNoteParts]
        .filter(Boolean)
        .join(" · ");
      const promptText = [
        title.trim(),
        selections.theme ? `About: ${selections.theme}` : null,
        selections.language ? `Language: ${selections.language}` : null,
        ...noteParts,
      ]
        .filter(Boolean)
        .join(" — ");

      const { data: row, error: insertErr } = await supabase
        .from("songs")
        .insert({
          user_id: user.id,
          title: title.trim() || null,
          prompt: promptText || title.trim() || "Untitled",
          style: style || null,
          lyrics,
          status: "draft",
        })
        .select("id")
        .single();

      if (insertErr || !row?.id) {
        toast.error(insertErr?.message || "Couldn't save song");
        return;
      }

      const { error: genErr } = await supabase.functions.invoke("suno-generate", {
        body: {
          song_id: row.id,
          prompt: promptText,
          lyrics,
          title: title.trim() || null,
          style: style || null,
        },
      });
      if (genErr) {
        toast.error(invokeError(genErr, "Could not start generation"));
        return;
      }
      toast.success(`Generating your song · -${previewCost} coins`);
      navigate({ to: "/library/$songId", params: { songId: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate song");
    } finally {
      setGenSong(false);
    }
  }

  const library = useQuery({
    queryKey: ["library", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Song[]> => {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as Song[];
    },
  });

  const versionedLibrary = useMemo(() => {
    const list = library.data ?? [];
    const sortedAsc = [...list].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const totals = new Map<string, number>();
    const running = new Map<string, number>();
    const versionOf = new Map<string, number>();
    for (const s of sortedAsc) {
      const key = (s.title || "Untitled").trim().toLowerCase();
      totals.set(key, (totals.get(key) ?? 0) + 1);
      const next = (running.get(key) ?? 0) + 1;
      running.set(key, next);
      versionOf.set(s.id, next);
    }
    return list.map((s) => {
      const key = (s.title || "Untitled").trim().toLowerCase();
      const total = totals.get(key) ?? 1;
      const v = versionOf.get(s.id) ?? 1;
      const base = s.title || "Untitled";
      const display = total > 1 ? `${base} · Version ${v}` : base;
      return { ...s, title: display };
    });
  }, [library.data]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("songs-library")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "songs", filter: `user_id=eq.${user.id}` },
        () => library.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Refresh the library list immediately when explicit-mode is toggled so the
  // results reflect the new preference without a manual reload.
  useEffect(() => {
    if (!user) return;
    library.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foulMouth]);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("songs").delete().eq("id", pendingDelete.id);
      if (error) throw error;
      toast.success("Track deleted");
      setPendingDelete(null);
      library.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-1 pb-12 sm:px-0">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/25 via-fuchsia-500/15 to-background p-6 shadow-card sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl"
        />
        <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
              <Music4 className="h-3 w-3 text-primary" /> Create a song
            </div>
            <h1 className="font-display text-4xl font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
              Hey <em className="not-italic text-gradient-brand">{firstName}</em>.
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Pick your vibe. We'll do the rest.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-end">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-background/60 px-4 py-2.5 shadow-glow backdrop-blur">
              <Coins className="h-5 w-5 text-primary" />
              <div className="leading-tight">
                <div className="text-base font-black">{balance}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  coins
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="relative mt-6 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <span>Progress</span>
            <span>{totalFilled}/6</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-brand transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Library — previews created (above creation options) */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Your library · previews
          </h2>
          {versionedLibrary.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {versionedLibrary.length} track{versionedLibrary.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {library.isLoading ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : versionedLibrary.length > 0 ? (
          <div className="grid gap-3">
            {versionedLibrary.map((s) => (
              <div key={s.id} className="relative">
                <Link
                  to="/library/$songId"
                  params={{ songId: s.id }}
                  className="block rounded-2xl transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SongCard song={s} />
                </Link>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute right-3 top-3 h-8 w-8 opacity-90 shadow-md"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPendingDelete(s);
                  }}
                  aria-label="Delete track"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-card/40 p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-fuchsia-500/10">
              <LibraryIcon className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-3 text-sm font-bold">No previews yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your first track below — versions will appear here.
            </p>
          </div>
        )}
      </section>

      {/* Title card */}
      <section className="rounded-3xl border border-white/10 bg-card/60 p-5 shadow-card backdrop-blur-xl sm:p-7">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-fuchsia-500/20 text-xl">
            🎙️
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Track title
            </div>
            <Input
              id="song-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name this song..."
              maxLength={120}
              className="border-0 bg-transparent px-0 text-xl font-bold focus-visible:ring-0 sm:text-2xl"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const TITLES = [
                "Late night drive", "Sunday hangover", "Gym warm-up",
                "Festival anthem", "Heartbreak letter", "Pirate radio cypher",
                "Summer rooftop", "Last train home", "Glow-up season",
                "City lights blur", "Toxic ex anthem", "Underdog story",
              ];
              const LYRICS_SAMPLES = [
                "[Verse]\nNeon on the windshield, city talking back\nMidnight running engines on the same old track\n\n[Chorus]\nDrive, drive, don't look behind\nLeave the noise, leave it all behind",
                "[Verse]\nWoke up with the curtains screaming sunlight\nLast night's promises evaporate, alright\n\n[Chorus]\nSunday hangover, holding my head\nReplay the things that we should've said",
                "[Verse]\nSpotlight hits, the crowd goes silent waiting\nEvery heartbeat in the room participating\n\n[Chorus]\nHands up, this is our anthem now\nWe rise, we shake, we take a bow",
                "[Verse]\nI wrote your name on every page I'm turning\nStill the candle of your memory keeps burning\n\n[Chorus]\nLetter never sent, I read it every night\nWords I never said, the love I couldn't write",
              ];
              const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
              setTitle(pick(TITLES));
              setSelections({
                language: pick(POOLS.language),
                genre: pick(POOLS.genre),
                mood: pick(POOLS.mood),
                theme: pick(POOLS.theme),
                tempo: pick(POOLS.tempo),
              });
              setCategoryNotes({ language: "", genre: "", mood: "", theme: "", tempo: "" });
              setLyrics(pick(LYRICS_SAMPLES));
              setFoulMouth(Math.random() < 0.5);
              toast.success("Surprise prompt loaded");
            }}
            className="shrink-0 gap-1.5"
          >
            <Shuffle className="h-4 w-4" />
            Surprise me
          </Button>
        </div>
      </section>

      {/* Category bento */}
      <section className="grid gap-4 sm:grid-cols-2">
        {(["language", "genre", "mood", "theme", "tempo"] as Category[]).map((cat) => (
          <CategoryCard
            key={cat}
            cat={cat}
            value={selections[cat]}
            chips={chips[cat]}
            note={categoryNotes[cat]}
            onNoteChange={(v) => setCategoryNotes((prev) => ({ ...prev, [cat]: v }))}
            onSelect={(v) => setField(cat, v)}
            onPickChip={(v) => pickChip(cat, v)}
            onRefresh={() => refreshRow(cat)}
          />
        ))}

      </section>

      {/* Step 1 — full-page lyric brief form */}
      <section
        id="lyric-brief"
        className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/25 via-fuchsia-500/15 to-background p-5 shadow-glow sm:p-8 lg:p-10 flex flex-col gap-7 min-h-[calc(100svh-7rem)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-primary/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl"
        />

        <header className="relative space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Step 1 — Lyric brief
          </div>
          <h2 className="font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Write lyrics
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            Tell OG Bot anything you want — names, places, jokes, drama, dreams. The more specific, the sharper the song.
          </p>
        </header>

        {/* Big action row — Surprise me + Get to know me */}
        <div className="relative grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            size="lg"
            onClick={() => {
              const TEMPLATES = [
                "Their name: Aaliyah\nOccasion: 30th birthday\nInside joke: still can't parallel park\nWhat they love: oat-milk lattes",
                "Their name: Marcus\nStory: ghosted me after 2 years\nCity: Manchester\nInside joke: \"I'll text you back\" — never did",
                "Their name: Sam & Jordan\nOccasion: wedding day\nWhat they love: late-night taco runs\nInside joke: the karaoke night we don't talk about",
                "Their name: Dre\nOccasion: promotion at work\nCity: Brooklyn\nWhat they love: never missing leg day",
              ];
              const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
              setPersonalDetails(pick(TEMPLATES).slice(0, 500));
              toast.success("Surprise brief loaded");
            }}
            className="h-14 w-full justify-center gap-2 rounded-2xl bg-gradient-brand text-base font-bold text-primary-foreground shadow-glow sm:h-16 sm:text-lg"
          >
            <Shuffle className="h-5 w-5" />
            🎲 Surprise me
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => setInterviewOpen(true)}
            className="h-14 w-full justify-center gap-2 rounded-2xl border-2 border-primary/40 bg-primary/10 text-base font-bold text-foreground hover:border-primary hover:bg-primary/20 sm:h-16 sm:text-lg"
          >
            <MessageCircleHeart className="h-5 w-5 text-primary" />
            Get to know me
          </Button>
        </div>

        {/* Personal details — the main writing area */}
        <div className="relative rounded-2xl border-2 border-primary/40 bg-primary/[0.06] p-5 shadow-glow sm:p-6">
          <div className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow">
            <Sparkles className="h-3.5 w-3.5" /> Recommended — best results
          </div>
          <Label htmlFor="personal-details" className="block text-lg font-bold text-foreground sm:text-xl">
            Tell us anything personal
          </Label>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Names, nicknames, places, dates, inside jokes, favourite foods, drama — anything you want woven into the lyrics.
          </p>

          {/* Quick-insert chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { label: "👤 Their name", snippet: "Their name: " },
              { label: "🎂 Occasion", snippet: "Occasion: " },
              { label: "💛 What they love", snippet: "What they love: " },
              { label: "🤫 Inside joke", snippet: "Inside joke: " },
              { label: "📍 City / place", snippet: "City: " },
              { label: "💔 Drama / story", snippet: "Story: " },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() =>
                  setPersonalDetails((v) => {
                    const sep = v.length === 0 ? "" : v.endsWith("\n") ? "" : "\n";
                    return (v + sep + chip.snippet).slice(0, 500);
                  })
                }
                className="rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-1.5 text-sm font-semibold text-foreground/85 transition hover:border-primary/60 hover:bg-primary/15 hover:text-foreground"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {(() => {
            const MAX = 500;
            const len = personalDetails.length;
            const trimmed = personalDetails.trim();
            const hasName = /name\s*[:\-]/i.test(trimmed) || /^[A-Z][a-z]+/m.test(trimmed);
            const hasDetail = /(occasion|love|joke|story|city|place)\s*[:\-]/i.test(trimmed);
            const pct = (len / MAX) * 100;
            let status: "empty" | "tiny" | "warn" | "good" | "near" | "full";
            let msg: string;
            if (len === 0) { status = "empty"; msg = "👆 Type anything you want — or tap Get to know me"; }
            else if (len < 20) { status = "tiny"; msg = "Add a name and an occasion for best results"; }
            else if (!hasName) { status = "warn"; msg = "💡 Add a name (e.g. \"Their name: Aaliyah\")"; }
            else if (!hasDetail) { status = "warn"; msg = "💡 Add an occasion, love, or inside joke"; }
            else if (len > MAX - 30) { status = "near"; msg = "Almost at the limit"; }
            else { status = "good"; msg = "✓ Looking good — the more specific, the better"; }
            if (len >= MAX) { status = "full"; msg = "Character limit reached"; }
            const tone =
              status === "good" ? "text-emerald-400" :
              status === "warn" || status === "tiny" ? "text-amber-400" :
              status === "near" || status === "full" ? "text-destructive" :
              "text-muted-foreground";
            const barTone =
              status === "full" || status === "near" ? "bg-destructive" :
              status === "good" ? "bg-emerald-500" :
              status === "warn" || status === "tiny" ? "bg-amber-500" :
              "bg-primary/40";
            return (
              <>
                <Textarea
                  id="personal-details"
                  aria-describedby="personal-details-help personal-details-count"
                  aria-invalid={status === "full" || status === "near"}
                  value={personalDetails}
                  onChange={(e) => setPersonalDetails(e.target.value.slice(0, MAX))}
                  placeholder="✍️ Type here — anything personal. Names, places, inside jokes, drama, dreams…&#10;&#10;e.g.&#10;Their name: Aaliyah&#10;Occasion: 30th birthday&#10;Inside joke: the karaoke night we don't talk about"
                  maxLength={MAX}
                  rows={10}
                  className="mt-4 min-h-[240px] resize-y rounded-xl border-primary/30 bg-background/60 text-base leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/40 sm:text-lg"
                />
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cn("h-full transition-all", barTone)}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
                  <span id="personal-details-help" className={cn("min-w-0 truncate font-medium", tone)} aria-live="polite">{msg}</span>
                  <span
                    id="personal-details-count"
                    className={cn("shrink-0 tabular-nums font-semibold", tone)}
                  >
                    {len}/{MAX}
                  </span>
                </div>
              </>
            );
          })()}
        </div>

        {/* Extra context */}
        <div className="relative">
          <Label htmlFor="extra-context" className="text-sm font-bold uppercase tracking-wider text-muted-foreground sm:text-base">
            Extra context <span className="font-normal normal-case">(optional)</span>
          </Label>
          <Textarea
            id="extra-context"
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder="Anything else the AI should know before writing…"
            maxLength={1000}
            rows={3}
            className="mt-2 min-h-[96px] resize-y rounded-xl border-white/10 bg-background/40 text-base sm:text-lg"
          />
        </div>

        {/* Foul mouth toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={foulMouth}
          aria-label={
            foulMouth
              ? "OG Foul Mouth is on. Activate to turn explicit mode off."
              : "OG Foul Mouth is off. Activate to turn explicit mode on."
          }
          aria-describedby="foul-mouth-status"
          onClick={() => !genLyrics && setFoulMouth((v) => !v)}
          onKeyDown={(e) => {
            if (genLyrics) return;
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              setFoulMouth((v) => !v);
            }
          }}
          disabled={genLyrics}
          className={cn(
            "relative group flex w-full min-h-14 items-center justify-between gap-3 rounded-2xl border-2 px-5 py-4 text-left transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            foulMouth
              ? "border-destructive bg-destructive/15 shadow-[0_0_24px_-6px_oklch(0.62_0.22_25_/_0.6)]"
              : "border-white/15 bg-white/[0.04] hover:border-white/25",
          )}
        >
          <div className="flex items-center gap-4">
            <div aria-hidden className={cn(
              "grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl transition",
              foulMouth ? "bg-destructive/30" : "bg-white/5",
            )}>
              {foulMouth ? "🤬" : "🧼"}
            </div>
            <div>
              <div className="text-base font-bold leading-tight sm:text-lg">OG Foul Mouth</div>
              <div
                id="foul-mouth-status"
                aria-live="polite"
                className={cn(
                  "text-sm leading-tight",
                  foulMouth ? "font-semibold text-destructive-foreground/90" : "text-muted-foreground",
                )}
              >
                {foulMouth ? "EXPLICIT — full swearing ON" : "Clean version — tap to go explicit"}
              </div>
            </div>
          </div>
          <span
            aria-hidden
            className={cn(
              "pointer-events-none inline-flex shrink-0 items-center justify-center rounded-full border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition",
              foulMouth
                ? "border-destructive bg-destructive text-destructive-foreground shadow-[0_0_18px_-4px_oklch(0.62_0.22_25_/_0.8)]"
                : "border-white/25 bg-white/10 text-foreground",
            )}
          >
            {foulMouth ? "Turn off" : "Turn on"}
          </span>
        </button>

        {/* Generate CTA */}
        <div className="relative mt-auto">
          <Button
            onClick={generateLyrics}
            disabled={!canGenerateLyrics || genLyrics}
            size="lg"
            className="h-16 w-full gap-2 rounded-2xl bg-gradient-brand text-lg font-black text-primary-foreground shadow-glow sm:h-[68px] sm:text-xl"
          >
            {genLyrics ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            {lyrics ? "Regenerate lyrics" : "Generate lyrics"} · -{lyricsCost}
          </Button>
          {!canGenerateLyrics && !genLyrics && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Pick a language and at least one style detail above to unlock
            </p>
          )}
        </div>
      </section>

      {/* Lyrics result */}
      {lyrics && (
        <section className="space-y-4 rounded-3xl border border-primary/30 bg-card/60 p-5 shadow-glow backdrop-blur-xl sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-primary">
                <Mic2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold">Your lyrics</p>
                <p className="text-[11px] text-muted-foreground">Edit freely before generating</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={generateLyrics} disabled={genLyrics} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${genLyrics ? "animate-spin" : ""}`} />
              New version
            </Button>
          </div>
          <Textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            className="min-h-[280px] resize-y rounded-2xl border-white/10 bg-background/40 font-mono text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-white/10 bg-background/40 p-4">
            <Button
              onClick={() => setReviewOpen(true)}
              disabled={genSong || balance < previewCost}
              size="lg"
              className="gap-2 bg-gradient-brand text-primary-foreground shadow-glow"
            >
              {genSong ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Review & make the song · -{previewCost}
            </Button>
          </div>
        </section>
      )}




      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this track?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title || "Untitled"}" will be removed from the library. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OgInterviewDialog
        open={interviewOpen}
        onOpenChange={setInterviewOpen}
        seed={personalDetails}
        onDone={(brief) => {
          setPersonalDetails((prev) => {
            const trimmed = brief.trim();
            if (!trimmed) return prev;
            if (!prev.trim()) return trimmed.slice(0, 500);
            const merged = `${prev.trim()}\n${trimmed}`;
            return merged.slice(0, 500);
          });
        }}
      />
    </div>
  );
}

function CategoryCard({
  cat,
  value,
  chips,
  note,
  onNoteChange,
  onSelect,
  onPickChip,
  onRefresh,
}: {
  cat: Category;
  value: string | undefined;
  chips: string[];
  note: string;
  onNoteChange: (v: string) => void;
  onSelect: (v: string) => void;
  onPickChip: (v: string) => void;
  onRefresh: () => void;
}) {
  const meta = META[cat];
  const Icon = meta.icon;
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-card/70 p-5 shadow-card backdrop-blur-xl transition-all hover:border-white/20 sm:p-6">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${meta.gradient} blur-2xl`}
      />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-lg ${meta.iconBg}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${meta.accent}`}>
                {meta.emoji} {meta.label}
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {value ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${meta.accent}`} />
                    {value}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{meta.helper}</span>
                )}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            aria-label={`Shuffle ${meta.label} suggestions`}
            className={`h-8 shrink-0 gap-1.5 px-2.5 text-xs font-semibold ${meta.accent} hover:bg-white/5`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Shuffle
          </Button>
        </div>

        <Select value={value ?? ""} onValueChange={onSelect}>
          <SelectTrigger className="h-11 w-full rounded-xl border-white/10 bg-background/50 text-sm font-medium">
            <SelectValue placeholder={meta.placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {POOLS[cat].map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Quick picks
          </div>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
              const active = value === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onPickChip(chip)}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5 " +
                    (active
                      ? meta.chipActive
                      : "border-white/10 bg-white/[0.04] text-foreground/85 hover:border-white/25 hover:bg-white/10")
                  }
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={`note-${cat}`}
            className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            <span>Add your own {meta.label.toLowerCase()} notes</span>
            <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70">
              {note.length}/200
            </span>
          </label>
          <Textarea
            id={`note-${cat}`}
            value={note}
            maxLength={200}
            onChange={(e) => onNoteChange(e.target.value.slice(0, 200))}
            placeholder={`e.g. extra ${meta.label.toLowerCase()} details for the AI to weave in…`}
            className="min-h-[64px] resize-y rounded-xl border-white/10 bg-background/40 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
