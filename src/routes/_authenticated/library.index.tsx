import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Library as LibraryIcon,
  Sparkles,
  RefreshCw,
  Wand2,
  Music2,
  Coins,
  Trash2,
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
import { Label } from "@/components/ui/label";
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

const LABEL: Record<Category, string> = {
  language: "Language",
  genre: "Genre",
  mood: "Mood",
  theme: "Theme",
  tempo: "Tempo",
};

const PLACEHOLDER: Record<Category, string> = {
  language: "Pick a language",
  genre: "Pick a genre",
  mood: "Pick a mood",
  theme: "Pick a theme",
  tempo: "Pick a tempo",
};

// Light affinity bias so contextual replacements feel coherent.
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

  // Smart bias: when picking mood replacements and a genre is set,
  // prefer moods from the genre's affinity list.
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

  // Past songs list
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      {/* Welcome */}
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Music Hub</p>
        <h1 className="font-display text-3xl font-light leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          Welcome back, <em className="italic text-gradient-brand">{firstName}</em>
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Let's create your lyrics. Tap a vibe in any row, hit refresh for more, or pick from the
          dropdown.
        </p>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" /> {balance} coins
        </div>
      </header>

      {/* Composer */}
      <section className="space-y-5 rounded-2xl border border-white/10 bg-card/60 p-5 shadow-card backdrop-blur-xl sm:p-7">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
          <Label htmlFor="song-title" className="text-sm font-medium">Title</Label>
          <Input
            id="song-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name this song"
            maxLength={120}
          />
        </div>

        {(["language", "genre", "mood", "theme", "tempo"] as Category[]).map((cat) => (
          <CategoryRow
            key={cat}
            cat={cat}
            value={selections[cat]}
            chips={chips[cat]}
            onSelect={(v) => setField(cat, v)}
            onPickChip={(v) => pickChip(cat, v)}
            onRefresh={() => refreshRow(cat)}
          />
        ))}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            onClick={generateLyrics}
            disabled={!canGenerateLyrics || genLyrics}
            size="lg"
            className="gap-2 bg-gradient-brand text-primary-foreground shadow-glow"
          >
            {genLyrics ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {lyrics ? "Regenerate lyrics" : "Generate lyrics"} · -{lyricsCost}
          </Button>
          {!canGenerateLyrics && !lyrics && (
            <p className="text-xs text-muted-foreground">
              Add a title, pick a language, and at least one more vibe to start.
            </p>
          )}
        </div>

        {lyrics && (
          <div className="space-y-4 rounded-xl border border-primary/30 bg-background/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-primary">Your lyrics</p>
              <Button variant="ghost" size="sm" onClick={generateLyrics} disabled={genLyrics}>
                <RefreshCw className={`h-3.5 w-3.5 ${genLyrics ? "animate-spin" : ""}`} />
                New version
              </Button>
            </div>
            <Textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              className="min-h-[280px] font-mono text-sm leading-relaxed"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={generateSong}
                disabled={genSong || balance < previewCost}
                size="lg"
                className="gap-2"
              >
                {genSong ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Generate my song · -{previewCost}
              </Button>
              <p className="text-xs text-muted-foreground">
                Suno builds a compressed sample. Download the full track for{" "}
                <span className="font-semibold text-foreground">{downloadCost} OG coins</span>.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Past songs */}
      <section>
        <h2 className="mb-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Your recent songs
        </h2>
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
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-border bg-background">
              <LibraryIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">No songs yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Fill in the form above and hit Generate my song.
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

function CategoryRow({
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
  return (
    <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
      <Label className="text-sm font-medium">{LABEL[cat]}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={value ?? ""} onValueChange={onSelect}>
          <SelectTrigger className="h-9 w-[180px] shrink-0">
            <SelectValue placeholder={PLACEHOLDER[cat]} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {POOLS[cat].map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {chips.map((chip) => {
          const active = value === chip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => onPickChip(chip)}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition-all hover:-translate-y-0.5 " +
                (active
                  ? "border-primary bg-primary/20 text-primary shadow-glow"
                  : "border-white/10 bg-white/5 text-foreground/80 hover:border-primary/40 hover:bg-white/10")
              }
            >
              {chip}
            </button>
          );
        })}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          aria-label={`Refresh ${LABEL[cat]} suggestions`}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
