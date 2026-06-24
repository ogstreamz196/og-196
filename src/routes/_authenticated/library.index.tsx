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
  
  Mic2,
  Music4,
  Shuffle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

function SongCardSkeleton({ label }: { label?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <div className="flex gap-2">
            <Skeleton className="h-2 flex-1 rounded-full" />
          </div>
        </div>
        <Skeleton className="hidden h-8 w-20 rounded-lg sm:block" />
      </div>
      {label && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          {label}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/library/")({
  component: LibraryPage,
});

type Category = "language" | "genre" | "mood" | "theme";

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
    "Happy & Upbeat", "Sad & Slow", "Angry & Hype", "Romantic & Chill",
    "Hype & Floor-filler", "Chill groove", "Melancholy & Slow burn",
    "Confident & Bouncy", "Heartbroken ballad", "Nostalgic & Mid-tempo",
    "Playful & Bouncy", "Dark & Half-time", "Hopeful & Upbeat",
    "Triumphant marching", "Dreamy & Slow", "Rebellious & Frenetic",
    "Bittersweet mid-tempo",
  ],
  theme: [
    "Love", "Heartbreak", "Money", "Party", "Family", "Revenge",
    "Friendship", "Hustle", "Loss", "Self-belief", "Summer nights",
    "City lights", "Late-night drive", "First crush", "Coming home",
    "Underdog story", "Toxic ex", "Glow-up",
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
    label: "Mood & Tempo",
    helper: "How should it feel and move?",
    placeholder: "Pick a vibe",
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
  const [lyrics, setLyrics] = useState("");
  const [genLyrics, setGenLyrics] = useState(false);
  const [foulMouth, setFoulMouth] = useState(false);
  const [personalDetails, setPersonalDetails] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [genSong, setGenSong] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Build a human-readable line from the current category selections.
  const selectionsLine = useMemo(() => {
    const cats: Category[] = ["language", "genre", "mood", "theme"];
    return cats
      .map((c) => (selections[c] ? `${META[c].label}: ${selections[c]}` : null))
      .filter(Boolean)
      .join(" · ");
  }, [selections]);

  // Sync the auto-built line into the lyric description box. Preserve any
  // free-text the user added below the auto-line on their own.
  useEffect(() => {
    setExtraContext((prev) => {
      const marker = "—".repeat(3);
      const split = prev.split(`\n${marker}\n`);
      const userTail = split.length > 1 ? split.slice(1).join(`\n${marker}\n`) : "";
      if (!selectionsLine && !userTail) return "";
      if (!selectionsLine) return userTail;
      return userTail ? `${selectionsLine}\n${marker}\n${userTail}` : selectionsLine;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionsLine]);


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
    () => [selections.genre, selections.mood].filter(Boolean) as string[],
    [selections.genre, selections.mood],
  );

  const filledExtras =
    (selections.genre ? 1 : 0) +
    (selections.mood ? 1 : 0) +
    (selections.theme ? 1 : 0);

  const totalFilled =
    (title.trim() ? 1 : 0) + (selections.language ? 1 : 0) + filledExtras;
  const progress = Math.min(100, Math.round((totalFilled / 5) * 100));

  const canGenerateLyrics =
    !!title.trim() && !!selections.language && filledExtras >= 1 && balance >= lyricsCost;

  async function generateLyrics() {
    if (!canGenerateLyrics) return;
    setGenLyrics(true);
    try {
      const description = [
        selections.theme ? `Theme: ${selections.theme}` : null,
        selections.mood ? `Mood & Tempo: ${selections.mood}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const combinedExtra = extraContext.trim();

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
      const style = [selections.genre, selections.mood]
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
          extra_context: extraContext.trim() || null,
        } as never)
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-20 sm:gap-12">
      {/* Hero — premium kicker, oversized headline, generous breathing room */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 pb-6 sm:pb-8">
        <div className="min-w-0 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-primary shadow-[0_0_24px_-10px_oklch(0.7_0.2_300_/_0.8)]">
            <Music4 className="h-3.5 w-3.5 shrink-0" /> Music Hub
          </div>
          <h1 className="font-display text-3xl font-black leading-[1.05] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
            Hey <span className="text-gradient-brand">{firstName}</span> — let's write a song.
          </h1>
          <p className="hidden text-base text-muted-foreground sm:block sm:text-lg">
            Tell us about them, pick a vibe, generate. Three steps to a finished track.
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-card/60 px-3 py-2 shadow-[0_8px_28px_-12px_oklch(0.7_0.2_300_/_0.45)] sm:gap-2.5 sm:px-4 sm:py-2.5">
          <Coins className="h-5 w-5 text-primary" />
          <span className="text-lg font-black tabular-nums sm:text-xl">{balance}</span>
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:inline">coins</span>
        </div>
      </header>





      {/* Library — previews created (above creation options) */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            MusicHUB · previews
          </h2>
          {versionedLibrary.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {versionedLibrary.length} track{versionedLibrary.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {library.isLoading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <SongCardSkeleton key={i} />
            ))}
          </div>
        ) : versionedLibrary.length > 0 || genSong ? (
          <div className="grid gap-3">
            {genSong && <SongCardSkeleton label="Generating" />}
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
            <p className="mt-3 text-sm font-bold tracking-wide leading-relaxed">No previews yet</p>
            <p className="mt-1 text-xs leading-relaxed tracking-wide text-muted-foreground">
              Scroll down to write your first track — versions will appear here.
            </p>

          </div>
        )}
      </section>

      {/* Lyrics generating skeleton */}
      {genLyrics && !lyrics && (
        <section className="space-y-3 rounded-2xl border border-primary/30 bg-card/60 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm font-bold">OG is writing your lyrics…</p>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-10/12" />
            <Skeleton className="mt-3 h-3 w-1/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-9/12" />
            <Skeleton className="h-3 w-11/12" />
          </div>
        </section>
      )}

      {/* Step 1 — Name your song */}
      <section className="rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card/80 to-card/60 p-6 shadow-[0_24px_70px_-30px_oklch(0.7_0.2_300_/_0.55)] ring-1 ring-white/5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-primary-foreground shadow-[0_0_20px_-4px_oklch(0.7_0.2_300_/_0.7)]">
            <Sparkles className="h-3.5 w-3.5" /> Step 1
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Start here
          </span>
        </div>
        <Label
          htmlFor="song-title"
          className="mt-4 block font-display text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl"
        >
          Name your song
        </Label>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Give it a working title — you can change this later.
        </p>
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground sm:text-base">

          <p className="font-semibold text-foreground">What to enter first 👇</p>
          <p className="mt-1">
            Type a short, catchy name that captures the vibe — a moment, a feeling, or a person
            (e.g. <span className="italic">"Late night drive"</span>,{" "}
            <span className="italic">"Mum's birthday"</span>). Stuck? Tap{" "}
            <span className="font-semibold text-foreground">Surprise me</span> for instant ideas.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-stretch gap-2">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/20 text-xl sm:h-14 sm:w-14 sm:text-2xl">
            🎙️
          </div>
          <Input
            id="song-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Late night drive"
            maxLength={120}
            className="h-12 min-w-0 flex-1 rounded-xl border-2 border-primary/30 bg-background/80 px-3 text-xl font-bold focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 sm:h-14 sm:text-2xl"
          />
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
              const TEMPLATES = [
                "Their name: Aaliyah\nOccasion: 30th birthday\nInside joke: still can't parallel park\nWhat they love: oat-milk lattes",
                "Their name: Marcus\nStory: ghosted me after 2 years\nCity: Manchester\nInside joke: \"I'll text you back\" — never did",
                "Their name: Sam & Jordan\nOccasion: wedding day\nWhat they love: late-night taco runs\nInside joke: the karaoke night we don't talk about",
                "Their name: Dre\nOccasion: promotion at work\nCity: Brooklyn\nWhat they love: never missing leg day",
              ];
              const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
              setTitle(pick(TITLES));
              setSelections({
                language: pick(POOLS.language),
                genre: pick(POOLS.genre),
                mood: pick(POOLS.mood),
                theme: pick(POOLS.theme),
                
              });
              setPersonalDetails(pick(TEMPLATES).slice(0, 500));
              toast.success("Surprise prompt loaded");
            }}
            className="h-12 shrink-0 gap-1.5 rounded-xl sm:h-14"
          >
            <Shuffle className="h-4 w-4" />
            Surprise me
          </Button>
        </div>
      </section>

      {/* Step 1 — Personal */}
      <section
        id="personal-brief"
        className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-card/70 p-6 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.6)] ring-1 ring-white/5 backdrop-blur-xl sm:p-8"
      >
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Step 2 · Who's it for?
          </div>
          <h2 className="font-display text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl">
            Tell us about them
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            Partner, friend, parent, ex, even yourself — the more specific, the sharper the song.
          </p>
        </header>




        {/* Personal details — the main writing area */}
        <div className="relative rounded-xl border border-border bg-background/40 p-4 sm:p-5">
          <Label htmlFor="personal-details" className="block text-base font-bold text-foreground">
            Tell us about the person this song is for
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Names, places, key dates, inside jokes, what they love — anything you want woven into the lyrics.
          </p>

          {/* Quick-insert chips */}
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Quick-insert personality prompts"
          >
            {[
              { label: "😂 They're so funny", snippet: "They're so funny — " },
              { label: "🤪 They're so silly", snippet: "They're so silly — " },
              { label: "🎉 Life of the party", snippet: "Always the life of the party — " },
              { label: "💛 Heart of gold", snippet: "They've got a heart of gold — " },
              { label: "🔥 Total legend", snippet: "An absolute legend because — " },
              { label: "🫶 Always there for me", snippet: "Always there for me when — " },
              { label: "🧠 Wise beyond their years", snippet: "Wise beyond their years — " },
              { label: "💪 Tough as nails", snippet: "Tough as nails, never quits — " },
              { label: "🌞 Lights up the room", snippet: "Lights up every room — " },
              { label: "🎤 Karaoke menace", snippet: "An absolute karaoke menace — " },
              { label: "🛟 My rock", snippet: "Honestly, my rock — " },
              { label: "🥹 Makes me emotional", snippet: "Makes me emotional just thinking about — " },
              { label: "🚀 Always chasing dreams", snippet: "Always chasing the next big dream — " },
              { label: "🧃 Effortlessly cool", snippet: "Effortlessly cool without trying — " },
              { label: "🍕 Foodie soulmate", snippet: "My foodie soulmate — " },
              { label: "😈 A bit of a menace", snippet: "A loveable menace — " },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                aria-label={`Insert prompt: ${chip.label}`}
                onClick={() =>
                  setPersonalDetails((v) => {
                    const sep = v.length === 0 ? "" : v.endsWith("\n") ? "" : "\n";
                    return (v + sep + chip.snippet).slice(0, 500);
                  })
                }
                className="rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-1.5 text-sm font-semibold text-foreground/85 transition hover:border-primary/60 hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            if (len === 0) { status = "empty"; msg = "👆 Start with their name — then add anything that makes them them"; }
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
                  placeholder="✍️ Type here — who is this song for? Their name, what they love, your history, inside jokes…&#10;&#10;e.g.&#10;Their name: Aaliyah&#10;Occasion: her 30th birthday&#10;Inside joke: the karaoke night we don't talk about"
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

        {/* Lyric description — auto-filled from category selections; hidden from user but still wired into generation. */}
        <div className="sr-only" aria-hidden="true">
          <Label htmlFor="extra-context">Lyric description</Label>
          <Textarea
            id="extra-context"
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            tabIndex={-1}
            maxLength={1000}
            rows={4}
            readOnly
          />
        </div>


      </section>

      {/* Step 2 — Pick your sound */}
      <section className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-card/70 p-6 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.6)] ring-1 ring-white/5 backdrop-blur-xl sm:p-8">
        <header className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              <Disc3 className="h-3.5 w-3.5" /> Step 3 · Pick your sound
            </div>
            <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
              Choose the vibe
            </h2>
          </div>
          <span className="hidden text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground sm:block">
            {totalFilled}/5 picked
          </span>
        </header>


        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(["language", "genre", "mood", "theme"] as Category[]).map((cat) => (
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
        </div>


        {/* Compact mobile progress */}
        <div className="space-y-1.5 sm:hidden">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <span>Progress</span>
            <span>{totalFilled}/5</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-brand transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      {/* Step 3 — Finalize & generate */}
      <section className="space-y-5 rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card/80 to-card/60 p-6 shadow-[0_24px_70px_-30px_oklch(0.7_0.2_300_/_0.5)] ring-1 ring-white/5 sm:p-8">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-primary">
            <Wand2 className="h-3.5 w-3.5" /> Step 4 · Generate
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
            Write the lyrics
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            Set the explicit toggle and let OG cook. You'll review before paying for the full song.
          </p>
        </header>



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
        <div id="lyrics-section" className="relative scroll-mt-24">
          <Button
            onClick={generateLyrics}
            disabled={!canGenerateLyrics || genLyrics}
            size="lg"
            className="h-[68px] w-full gap-2.5 rounded-2xl bg-gradient-brand text-xl font-black text-primary-foreground shadow-glow ring-1 ring-primary/40 transition-transform hover:scale-[1.01] sm:h-20 sm:text-2xl"
          >
            {genLyrics ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            {lyrics ? "Regenerate lyrics" : "Generate lyrics"} · -{lyricsCost}
          </Button>
          {!canGenerateLyrics && !genLyrics && (
            <p className="mt-3 text-center text-sm font-medium text-muted-foreground">
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
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            spellCheck={false}
            aria-label="Lyrics (copying disabled)"
            className="min-h-[280px] resize-y rounded-2xl border-white/10 bg-background/40 font-mono text-sm leading-relaxed [-webkit-user-select:none] [user-select:none]"
            style={{ WebkitUserSelect: "none", userSelect: "none" }}
          />
          <p className="text-[11px] text-muted-foreground italic">
            🔒 Lyrics are protected — copy and right-click are disabled.
          </p>

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

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={(o) => !genSong && setReviewOpen(o)}
        title={title}
        selections={selections}
        personalDetails={personalDetails}
        extraContext={extraContext}
        foulMouth={foulMouth}
        lyrics={lyrics}
        previewCost={previewCost}
        generating={genSong}
        onConfirm={async () => {
          await generateSong();
        }}
      />

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
    <div className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-card/70 p-6 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.55)] ring-1 ring-white/5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] sm:p-7">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br ${meta.gradient} opacity-90 blur-2xl`}
      />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-xl ${meta.iconBg}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className={`text-xs font-bold uppercase tracking-[0.22em] ${meta.accent}`}>
                {meta.emoji} {meta.label}
              </div>
              <div className="mt-1.5 text-base font-semibold text-foreground">
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
            className={`h-9 shrink-0 gap-1.5 px-3 text-xs font-bold ${meta.accent} hover:bg-white/5`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Shuffle
          </Button>
        </div>

        <Select value={value ?? ""} onValueChange={onSelect}>
          <SelectTrigger className="h-12 w-full rounded-xl border-white/10 bg-background/50 text-base font-semibold">
            <SelectValue placeholder={meta.placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {POOLS[cat].map((opt) => (
              <SelectItem key={opt} value={opt} className="text-base">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>


        <div className="space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Quick picks
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => {
              const active = value === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onPickChip(chip)}
                  className={
                    "rounded-full border px-3.5 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 " +
                    (active
                      ? meta.chipActive
                      : "border-white/10 bg-white/[0.04] text-foreground/90 hover:border-white/25 hover:bg-white/10")
                  }
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}


function ReviewDialog({
  open,
  onOpenChange,
  title,
  selections,
  personalDetails,
  extraContext,
  foulMouth,
  lyrics,
  previewCost,
  generating,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  selections: Selections;
  personalDetails: string;
  extraContext: string;
  foulMouth: boolean;
  lyrics: string;
  previewCost: number;
  generating: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const cats: Category[] = ["language", "genre", "mood", "theme"];



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] w-[min(96vw,720px)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-white/10 bg-gradient-to-br from-primary/20 via-fuchsia-500/10 to-background px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Sparkles className="h-5 w-5 text-primary" />
            Review your brief
          </DialogTitle>
          <DialogDescription>
            Final check before OG Bot drops the track. Cost: {previewCost} coins.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-5">
            <section aria-labelledby="rv-track">
              <h3 id="rv-track" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Track
              </h3>
              <div className="mt-2 rounded-xl border border-white/10 bg-card/60 p-3">
                <p className="text-base font-bold">{title.trim() || "Untitled"}</p>
                {foulMouth && (
                  <span className="mt-1 inline-block rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                    Explicit
                  </span>
                )}
              </div>
            </section>

            <section aria-labelledby="rv-cats">
              <h3 id="rv-cats" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Style
              </h3>
              <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {cats.map((c) => {
                  const v = selections[c];
                  if (!v) return null;
                  return (
                    <div key={c} className="rounded-xl border border-white/10 bg-card/60 p-3">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {META[c].emoji} {META[c].label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold">{v}</dd>
                    </div>
                  );
                })}
              </dl>
            </section>



            {personalDetails.trim() && (
              <section aria-labelledby="rv-personal">
                <h3 id="rv-personal" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Personal details
                </h3>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/10 bg-card/60 p-3 font-sans text-sm leading-relaxed">
                  {personalDetails.trim()}
                </pre>
              </section>
            )}

            {extraContext.trim() && (
              <section aria-labelledby="rv-extra">
                <h3 id="rv-extra" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Extra context
                </h3>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-white/10 bg-card/60 p-3 font-sans text-sm leading-relaxed">
                  {extraContext.trim()}
                </pre>
              </section>
            )}

            {lyrics.trim() && (
              <section aria-labelledby="rv-lyrics">
                <h3 id="rv-lyrics" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Lyrics
                </h3>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-background/40 p-3 font-mono text-xs leading-relaxed">
                  {lyrics.trim()}
                </pre>
              </section>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 border-t border-white/10 bg-card/80 px-5 py-3 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={generating}
          >
            Edit
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={generating}
            className="gap-2 bg-gradient-brand text-primary-foreground shadow-glow"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Confirm & generate · -{previewCost}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
