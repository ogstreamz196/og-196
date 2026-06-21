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
  Download,
  Music4,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useProfile } from "@/hooks/use-profile";
import { useSettings } from "@/hooks/use-settings";
import { invokeError } from "@/lib/invoke-error";
import { SongCard, type Song } from "@/components/SongCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const { isAdmin } = useRole();
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const navigate = useNavigate();

  const lyricsCost = settings?.coins_per_lyrics_generation ?? 1;
  const previewCost = settings?.coins_per_generation ?? 3;
  const downloadCost = settings?.coins_per_full_unlock ?? 5;
  const balance = profile?.coin_balance ?? 0;
  const firstName = useMemo(() => {
    const raw = profile?.display_name?.trim() || user?.email?.split("@")[0] || "";
    return raw.split(/\s|\./)[0] || "there";
  }, [profile?.display_name, user?.email]);

  const [title, setTitle] = useState("");
  const [selections, setSelections] = useState<Selections>({});
  const [chips, setChips] = useState<Record<Category, string[]>>(() => initialChips());
  const [lyrics, setLyrics] = useState("");
  const [genLyrics, setGenLyrics] = useState(false);
  const [genSong, setGenSong] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      const description = [
        selections.theme ? `Theme: ${selections.theme}` : null,
        selections.mood ? `Mood: ${selections.mood}` : null,
        selections.tempo ? `Tempo: ${selections.tempo}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const { data, error } = await supabase.functions.invoke("generate-lyrics", {
        body: {
          songName: title.trim(),
          description,
          styleTags,
          language: selections.language,
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
      const style = [selections.genre, selections.mood, selections.tempo]
        .filter(Boolean)
        .join(" · ");
      const promptText = [
        title.trim(),
        selections.theme ? `About: ${selections.theme}` : null,
        selections.language ? `Language: ${selections.language}` : null,
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
              <Music4 className="h-3 w-3 text-primary" /> Music Hub
            </div>
            <h1 className="font-display text-4xl font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
              Yo <em className="not-italic text-gradient-brand">{firstName}</em>,
              <br className="hidden sm:block" /> let's cook a banger.
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Tap a vibe, hit refresh, mix &amp; match. We'll write the lyrics and Suno makes
              the sound.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-end">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-background/60 px-4 py-2.5 shadow-glow backdrop-blur">
              <Coins className="h-5 w-5 text-primary" />
              <div className="leading-tight">
                <div className="text-base font-black">{balance}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  OG coins
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="relative mt-6 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <span>Song recipe</span>
            <span>{totalFilled}/6 set</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-brand transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

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
            onSelect={(v) => setField(cat, v)}
            onPickChip={(v) => pickChip(cat, v)}
            onRefresh={() => refreshRow(cat)}
          />
        ))}

        {/* CTA card matches grid */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/25 via-fuchsia-500/15 to-background p-5 shadow-glow sm:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl"
          />
          <div className="relative flex h-full flex-col justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]">
                <Sparkles className="h-3 w-3 text-primary" /> Step 1
              </div>
              <h3 className="mt-3 font-display text-2xl font-black leading-tight tracking-tight">
                Write the lyrics
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Needs a title, language &amp; one more vibe.
              </p>
            </div>
            <Button
              onClick={generateLyrics}
              disabled={!canGenerateLyrics || genLyrics}
              size="lg"
              className="w-full gap-2 bg-gradient-brand text-primary-foreground shadow-glow"
            >
              {genLyrics ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {lyrics ? "Regenerate" : "Generate lyrics"} · -{lyricsCost}
            </Button>
          </div>
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
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-background/40 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Ready to hear it?</p>
              <p className="text-xs text-muted-foreground">
                Suno builds a compressed sample. Full download:{" "}
                <span className="inline-flex items-center gap-1 font-bold text-foreground">
                  <Download className="h-3 w-3" /> {downloadCost} coins
                </span>
              </p>
            </div>
            <Button
              onClick={generateSong}
              disabled={genSong || balance < previewCost}
              size="lg"
              className="gap-2 bg-gradient-brand text-primary-foreground shadow-glow"
            >
              {genSong ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Generate song · -{previewCost}
            </Button>
          </div>
        </section>
      )}

      {/* Past songs */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Your recent songs
          </h2>
        </div>
        {library.isLoading ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (library.data ?? []).length > 0 ? (
          <div className="grid gap-3">
            {(library.data ?? []).map((s) => (
              <div key={s.id} className="relative">
                <Link
                  to="/library/$songId"
                  params={{ songId: s.id }}
                  className="block rounded-2xl transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SongCard song={s} />
                </Link>
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute right-3 top-3 h-8 w-8 opacity-90"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPendingDelete(s);
                    }}
                    aria-label="Delete track"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-card/40 p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-fuchsia-500/10">
              <LibraryIcon className="h-6 w-6 text-primary" />
            </div>
            <p className="mt-4 text-base font-bold">No songs yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Pick your vibes above and tap Generate.
            </p>
          </div>
        )}
      </section>

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
    </div>
  );
}

function CategoryCard({
  cat,
  value,
  chips,
  onSelect,
  onPickChip,
  onRefresh,
}: {
  cat: Category;
  value: string | undefined;
  chips: string[];
  onSelect: (v: string) => void;
  onPickChip: (v: string) => void;
  onRefresh: () => void;
}) {
  const meta = META[cat];
  const Icon = meta.icon;
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-card/60 p-5 shadow-card backdrop-blur-xl transition-all hover:border-white/20 sm:p-6">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${meta.gradient} blur-2xl`}
      />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-base">
              <Icon className="h-4 w-4 text-foreground/80" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {meta.emoji} Pick a vibe
              </div>
              <div className="text-base font-bold">{meta.label}</div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            aria-label={`Refresh ${meta.label}`}
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Select value={value ?? ""} onValueChange={onSelect}>
          <SelectTrigger className="h-10 w-full rounded-xl">
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

        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => {
            const active = value === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => onPickChip(chip)}
                className={
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-all hover:-translate-y-0.5 " +
                  (active
                    ? "border-primary bg-primary/20 text-primary shadow-glow"
                    : "border-white/10 bg-white/5 text-foreground/80 hover:border-primary/40 hover:bg-white/10")
                }
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
