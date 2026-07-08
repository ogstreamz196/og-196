import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Library as LibraryIcon,
  Sparkles,
  RefreshCw,
  Wand2,
  Coins,
  Trash2,
  Mic2,
  Music4,
  Shuffle,
  Search,
  Users,
  Crown,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { improveLyricDescription } from "@/lib/improve-description.functions";

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
import { SongCardSkeleton } from "@/components/library/SongCardSkeleton";
import {
  
  META,
  PERSONAL_DETAILS_MAX,
  POOLS,
  SURPRISE_TEMPLATES,
  SURPRISE_TITLES,
  initialChips,
  personalDetailsCheck,
  pickFresh,
  randomPick,
  type Category,
  type Selections,
} from "@/lib/library-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Disc3, Flame } from "lucide-react";

import { PoweredByOgBot } from "@/components/PoweredByOgBot";
import { JobQueuePanel } from "@/components/library/JobQueuePanel";
import { CategoryCard } from "@/components/library/CategoryCard";
import { StyleComposer } from "@/components/library/StyleComposer";
import { CollapsibleStep } from "@/components/library/CollapsibleStep";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";
import { FoulMouthToggle } from "@/components/FoulMouthToggle";

import { ReviewDialog } from "@/components/library/ReviewDialog";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll-sentinel";


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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";



export const Route = createLazyFileRoute("/_authenticated/library/")({
  component: LibraryPage,
});

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
  const [subjectName, setSubjectName] = useState("");
  // Defaults: English locked as the default language. Genre/mood/theme are now
  // composed via the single StyleComposer field below (styleText).
  const [selections, setSelections] = useState<Selections>(() => ({
    language: "English",
  }));
  const [chips, setChips] = useState<Record<Category, string[]>>(() => initialChips());
  const [styleText, setStyleText] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [genLyrics, setGenLyrics] = useState(false);
  const { foulMouth } = useFoulMouth();
  const setFoulMouthMutation = useSetFoulMouth();
  const setFoulMouth = (updater: boolean | ((v: boolean) => boolean)) => {
    const next = typeof updater === "function" ? updater(foulMouth) : updater;
    setFoulMouthMutation.mutate(next);
  };
  const foulMouthSaving = setFoulMouthMutation.isPending;

  const [personalDetails, setPersonalDetails] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [genSong, setGenSong] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [yoursSearch, setYoursSearch] = useState("");
  const [showAllYours, setShowAllYours] = useState(false);
  const [communitySearch, setCommunitySearch] = useState("");

  // Build a human-readable line from language + freeform style text.
  const selectionsLine = useMemo(() => {
    const parts: string[] = [];
    if (selections.language) parts.push(`Language: ${selections.language}`);
    if (styleText.trim()) parts.push(`Style: ${styleText.trim()}`);
    return parts.join(" · ");
  }, [selections.language, styleText]);

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

  // Style tags fed to the AI = the tokens the user assembled in the composer.
  const styleTags = useMemo(
    () =>
      styleText
        .split(/[·,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10),
    [styleText],
  );

  const hasStyle = styleText.trim().length > 0;

  const totalFilled =
    (title.trim() ? 1 : 0) +
    (subjectName.trim() ? 1 : 0) +
    (personalDetails.trim().length >= 20 ? 1 : 0) +
    (selections.language ? 1 : 0) +
    (hasStyle ? 1 : 0);
  const progress = Math.min(100, Math.round((totalFilled / 5) * 100));

  const canGenerateLyrics =
    !!title.trim() &&
    !!subjectName.trim() &&
    !!selections.language &&
    hasStyle &&
    balance >= lyricsCost;

  async function generateLyrics() {
    if (!canGenerateLyrics) return;
    setGenLyrics(true);
    try {
      const description = styleText.trim();
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
          subjectName: subjectName.trim() || undefined,
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


  const generateLockRef = useRef(false);
  async function generateSong() {
    if (generateLockRef.current) return;
    if (!user) return;
    if (!lyrics.trim()) {
      toast.error("Generate lyrics first");
      return;
    }
    if (balance < previewCost) {
      toast.error(`Need ${previewCost} coins to generate a song`);
      return;
    }
    generateLockRef.current = true;
    setGenSong(true);
    try {
      // Backend enforces global + per-user concurrency limits (returns 429 when over capacity).
      const style = styleText.trim();
      const promptText = [
        title.trim(),
        subjectName.trim() ? `For: ${subjectName.trim()}` : null,
        style ? `Style: ${style}` : null,
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
      generateLockRef.current = false;
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

  // Active jobs (queued/processing/failed) for the queue panel; completed
  // tracks are rendered as cards below — never both, so nothing shows twice.
  const activeJobs = useMemo(
    () => versionedLibrary.filter((s) => s.status !== "completed"),
    [versionedLibrary],
  );
  const completedTracks = useMemo(
    () => versionedLibrary.filter((s) => s.status === "completed"),
    [versionedLibrary],
  );

  const COMMUNITY_PAGE_SIZE = 12;
  const community = useInfiniteQuery({
    queryKey: ["library-community", user?.id],
    enabled: !!user,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<Song[]> => {
      const offset = (pageParam as number) * COMMUNITY_PAGE_SIZE;
      // Uses a SECURITY DEFINER RPC that returns only safe public fields
      // (no prompts, lyrics, or generation metadata).
      const { data, error } = await supabase.rpc("list_community_songs", {
        p_offset: offset,
        p_limit: COMMUNITY_PAGE_SIZE,
      });
      if (error) throw error;
      // Fill missing required Song fields with safe defaults so the card renders.
      return (data ?? []).map((s: Record<string, unknown>) => ({
        prompt: "",
        ...s,
      })) as unknown as Song[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < COMMUNITY_PAGE_SIZE ? undefined : allPages.length,
  });
  const communityTracks = useMemo(
    () => community.data?.pages.flat() ?? [],
    [community.data],
  );
  const communitySentinelRef = useRef<HTMLDivElement | null>(null);
  useInfiniteScrollSentinel(communitySentinelRef, {
    enabled: !!community.hasNextPage && !community.isFetchingNextPage,
    onHit: () => community.fetchNextPage(),
    deps: [community.hasNextPage, community.isFetchingNextPage, communityTracks.length],
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

  // Detect songs that just finished (pending → completed) and surface an
  // explicit "Song is ready" toast plus a prominent Review banner.
  // Only tracks with status === "completed" reach `completedTracks`, so the
  // Review affordance never appears before the song is actually playable.
  const previouslyActiveRef = useRef<Set<string>>(new Set());
  const notifiedReadyRef = useRef<Set<string>>(new Set());
  const [readyToReview, setReadyToReview] = useState<{ id: string; title: string } | null>(null);
  const reviewBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const activeIds = new Set(activeJobs.map((s) => s.id));
    for (const song of completedTracks) {
      if (notifiedReadyRef.current.has(song.id)) continue;
      if (!previouslyActiveRef.current.has(song.id)) continue;
      notifiedReadyRef.current.add(song.id);
      const title = song.title || "Your song";
      setReadyToReview({ id: song.id, title });
      toast.success(`🎧 Song is ready · ${title}`, {
        id: `song-ready-${song.id}`,
        duration: 12000,
        action: {
          label: "Review",
          onClick: () =>
            navigate({
              to: "/library/$songId",
              params: { songId: song.id },
              hash: "song-player",
            }),
        },
      });
    }
    previouslyActiveRef.current = activeIds;
  }, [activeJobs, completedTracks, navigate]);

  // Move keyboard focus to the Review button when the banner first appears
  // so screen-reader and keyboard users can act on it immediately, and let
  // Escape dismiss it.
  useEffect(() => {
    if (!readyToReview) return;
    const t = window.setTimeout(() => reviewBtnRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReadyToReview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [readyToReview]);




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
    <div data-testid="library-root" data-scroll-fade className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-[calc(env(safe-area-inset-bottom)+96px)] [touch-action:pan-y] [scroll-padding-block:24px] md:pb-20">
      {/* Hero — premium kicker, oversized headline, generous breathing room */}
      <header data-testid="library-hero" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 pb-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black leading-[1.1] tracking-[-0.02em] break-words sm:text-5xl lg:text-6xl">
            Hey <span className="text-gradient-brand">{firstName}</span> — let's write a song.
          </h1>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-card/60 px-4 py-2 shadow-[0_8px_28px_-12px_oklch(0.7_0.2_300_/_0.45)]">
          <Coins className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-lg font-black tabular-nums sm:text-xl">{balance}</span>
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:inline">coins</span>
        </div>
      </header>

      {/* Prominent Review banner — only visible when a freshly finished song is waiting to be reviewed */}
      {readyToReview && (
        <section
          role="region"
          aria-labelledby="song-ready-heading"
          aria-live="polite"
          aria-atomic="true"
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-emerald-500/5 px-4 py-3 shadow-[0_20px_60px_-25px_rgba(16,185,129,0.7)] sm:gap-4 sm:px-6 sm:py-4"
        >
          <div className="min-w-0">
            <h2
              id="song-ready-heading"
              className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300"
            >
              <span aria-hidden="true">🎧 </span>Song is ready to play
            </h2>
            <p className="mt-0.5 truncate font-display text-lg font-black text-foreground sm:text-2xl">
              {readyToReview.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              ref={reviewBtnRef}
              type="button"
              onClick={() => {
                const id = readyToReview.id;
                setReadyToReview(null);
                navigate({
                  to: "/library/$songId",
                  params: { songId: id },
                  hash: "song-player",
                });
              }}
              aria-label={`Review ${readyToReview.title} — open the player`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-black uppercase tracking-wider text-emerald-950 shadow-[0_10px_28px_-8px_rgba(16,185,129,0.9)] ring-2 ring-emerald-300/60 transition hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 active:scale-95 sm:text-base"
            >
              Review now
            </button>
            <button
              type="button"
              onClick={() => setReadyToReview(null)}
              aria-label="Dismiss song ready notice"
              className="inline-grid min-h-11 min-w-11 place-items-center rounded-full border border-white/10 text-sm text-muted-foreground hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </section>
      )}



      {/* Library — luxury two-tab vault: Yours first, then Community */}
      <section>
        <div data-testid="library-your-header" className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">

          <div className="min-w-0 space-y-1">
            <div className="truncate text-xs font-bold uppercase tracking-[0.24em] text-primary">
              <Disc3 className="mr-1.5 inline h-3.5 w-3.5 -translate-y-0.5" />
              MusicHUB · Vault
            </div>
            <h2 data-testid="library-your-heading" className="truncate font-display text-2xl font-black tracking-tight sm:text-4xl">
              Your Library
            </h2>
            <p className="text-sm text-muted-foreground">
              Your tracks first. Community drops live in the next tab.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {versionedLibrary.length > 0 && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {versionedLibrary.length} track{versionedLibrary.length === 1 ? "" : "s"}
              </span>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={library.isFetching}
              onClick={async () => {
                const before = completedTracks.length;
                const beforeActive = activeJobs.length;
                const res = await library.refetch();
                const list = (res.data ?? []) as Song[];
                const after = list.filter((s) => s.status === "completed").length;
                const afterActive = list.filter((s) => s.status !== "completed").length;
                const newReady = after - before;
                if (newReady > 0) {
                  toast.success(`Library refreshed · ${newReady} new track${newReady === 1 ? "" : "s"} ready`);
                } else if (afterActive > 0) {
                  toast(`Still generating · ${afterActive} in progress`);
                } else if (beforeActive > 0 && afterActive === 0 && newReady === 0) {
                  toast("Library refreshed · no changes yet");
                } else {
                  toast.success("Library up to date");
                }
              }}
              className="h-9 gap-1.5 rounded-full"
              aria-label="Refresh library"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", library.isFetching && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {activeJobs.length > 0 && (
          <div className="mb-4">
            <JobQueuePanel songs={activeJobs} />
          </div>
        )}

        <Tabs defaultValue="yours" className="w-full">
          <TabsList className="mb-5 grid h-auto w-full grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-gradient-to-br from-card/80 to-card/40 p-1.5 shadow-[0_10px_40px_-20px_oklch(0.7_0.2_300_/_0.5)] backdrop-blur">
            <TabsTrigger
              value="yours"
              className="group flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary/30 data-[state=active]:to-fuchsia-500/15 data-[state=active]:text-foreground data-[state=active]:shadow-[0_8px_24px_-12px_oklch(0.7_0.2_300_/_0.7)] data-[state=active]:ring-1 data-[state=active]:ring-primary/40"
            >
              <Crown className="h-4 w-4 text-primary" />
              <span className="truncate">Yours</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black tabular-nums text-foreground/90">
                {completedTracks.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="community"
              className="group flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all data-[state=active]:bg-gradient-to-br data-[state=active]:from-fuchsia-500/25 data-[state=active]:to-primary/15 data-[state=active]:text-foreground data-[state=active]:shadow-[0_8px_24px_-12px_oklch(0.7_0.2_300_/_0.7)] data-[state=active]:ring-1 data-[state=active]:ring-fuchsia-400/40"
            >
              <Users className="h-4 w-4 text-fuchsia-300" />
              <span className="truncate">Community</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black tabular-nums text-foreground/90">
                {communityTracks.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="yours" className="mt-0 space-y-3">
            {completedTracks.length > 3 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={yoursSearch}
                  onChange={(e) => setYoursSearch(e.target.value)}
                  placeholder="Search your tracks…"
                  className="h-11 rounded-xl border-white/10 bg-white/[0.04] pl-9 text-sm"
                />
              </div>
            )}
            {library.isLoading ? (
              <div className="grid gap-3">
                {[0, 1, 2].map((i) => (
                  <SongCardSkeleton key={i} />
                ))}
              </div>
            ) : completedTracks.length > 0 || genSong ? (
              (() => {
                const q = yoursSearch.trim().toLowerCase();
                const filtered = q
                  ? completedTracks.filter(
                      (s) =>
                        (s.title || "").toLowerCase().includes(q) ||
                        (s.prompt || "").toLowerCase().includes(q) ||
                        (s.style || "").toLowerCase().includes(q),
                    )
                  : completedTracks;
                const PREVIEW_COUNT = 3;
                const isSearching = q.length > 0;
                const collapsed = !isSearching && !showAllYours && filtered.length > PREVIEW_COUNT;
                const visible = collapsed ? filtered.slice(0, PREVIEW_COUNT) : filtered;
                const hiddenCount = filtered.length - visible.length;
                return (
                  <div data-testid="library-cards" className="grid gap-3">
                    {genSong && <SongCardSkeleton label="Generating" />}
                    {filtered.length === 0 && !genSong ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No tracks match "{yoursSearch}".
                      </p>
                    ) : (
                      <>
                        {collapsed && (
                          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            Recently added · showing {visible.length} of {filtered.length}
                          </p>
                        )}
                        {visible.map((s) => (
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
                        {!isSearching && filtered.length > PREVIEW_COUNT && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAllYours((v) => !v)}
                            className="mt-1 h-11 w-full rounded-xl border-white/10 bg-white/[0.04] font-bold"
                          >
                            {showAllYours
                              ? `Show fewer · hide ${filtered.length - PREVIEW_COUNT}`
                              : `Show all ${filtered.length} tracks · +${hiddenCount} more`}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="rounded-3xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/10 to-card/40 p-10 text-center ring-1 ring-white/5">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-fuchsia-500/15 shadow-[0_12px_30px_-12px_oklch(0.7_0.2_300_/_0.6)]">
                  {activeJobs.length > 0 ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <Crown className="h-6 w-6 text-primary" />
                  )}
                </div>
                <p className="mt-4 font-display text-xl font-black leading-tight sm:text-2xl">
                  {activeJobs.length > 0 ? "Generating your first track…" : "Your vault is empty"}
                </p>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  {activeJobs.length > 0
                    ? "Hang tight — finished songs will land here as soon as they're ready."
                    : "Scroll down to write your first track — finished songs land here."}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="community" className="mt-0 space-y-3">
            {communityTracks.length > 3 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={communitySearch}
                  onChange={(e) => setCommunitySearch(e.target.value)}
                  placeholder="Search community tracks…"
                  className="h-11 rounded-xl border-white/10 bg-white/[0.04] pl-9 text-sm"
                />
              </div>
            )}
            {community.isLoading ? (
              <div className="grid gap-3">
                {[0, 1, 2].map((i) => (
                  <SongCardSkeleton key={i} />
                ))}
              </div>
            ) : communityTracks.length > 0 ? (
              (() => {
                const q = communitySearch.trim().toLowerCase();
                const filtered = q
                  ? communityTracks.filter(
                      (s) =>
                        (s.title || "").toLowerCase().includes(q) ||
                        (s.prompt || "").toLowerCase().includes(q) ||
                        (s.style || "").toLowerCase().includes(q),
                    )
                  : communityTracks;
                return (
                  <div className="grid gap-3">
                    {filtered.map((s) => (
                      <div key={s.id} className="block rounded-2xl">
                        <SongCard song={s} />
                      </div>
                    ))}
                    <div ref={communitySentinelRef} className="h-1" aria-hidden />
                    {community.isFetchingNextPage && (
                      <div className="grid gap-3">
                        {[0, 1].map((i) => (
                          <SongCardSkeleton key={`more-${i}`} label="Loading" />
                        ))}
                      </div>
                    )}
                    {!community.hasNextPage && (
                      <p className="py-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        You've reached the end
                      </p>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="rounded-3xl border border-dashed border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 to-card/40 p-10 text-center ring-1 ring-white/5">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-primary/15">
                  <Users className="h-6 w-6 text-fuchsia-300" />
                </div>
                <p className="mt-4 font-display text-xl font-black leading-tight sm:text-2xl">Nothing here yet</p>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  Be the first — finished tracks from the community will appear here.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
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

      {/* Unified create flow */}
      <section
        aria-labelledby="create-song-heading"
        className="relative flex flex-col gap-6 overflow-hidden rounded-[2rem] border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-card/80 to-card/60 p-5 shadow-[0_30px_90px_-35px_oklch(0.7_0.2_300_/_0.7)] ring-1 ring-white/5 sm:gap-8 sm:p-10"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-primary/40 via-fuchsia-500/25 to-transparent blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
        />
        <header className="relative grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-white/10 pb-5 sm:pb-6">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-primary sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Studio · new track
            </div>
            <h2
              id="create-song-heading"
              className="font-display text-4xl font-black leading-[1.02] tracking-[-0.02em] sm:text-6xl lg:text-7xl"
            >
              Create <span className="text-gradient-brand">a song</span>
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Five quick steps — title, name, describe, language, song style. Fill them in any order.
            </p>
          </div>
          <span className="shrink-0 self-start rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-primary sm:text-sm">
            {totalFilled}/5
          </span>
        </header>


        {/* Step 1 — Title */}
        <CollapsibleStep
          step={1}
          title="Title"
          done={!!title.trim()}
          summary={title.trim() || "Untitled"}
        >
          <div className="flex flex-wrap items-stretch gap-2">
            <Label htmlFor="song-title" className="sr-only">
              Title
            </Label>
            <Input
              id="song-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Late night drive"
              maxLength={120}
              className="h-12 min-w-0 flex-1 rounded-xl border-2 border-primary/30 bg-background/80 px-3 text-lg font-bold focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 sm:h-14 sm:text-xl"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTitle(randomPick(SURPRISE_TITLES));
                setSubjectName(
                  randomPick(["Aaliyah", "Marcus", "Sam", "Jordan", "Dre", "Priya", "Leo", "Maya"]),
                );
                setSelections({ language: randomPick(POOLS.language) });
                setStyleText(
                  `${randomPick(POOLS.genre)} · ${randomPick(POOLS.mood)} · ${randomPick(POOLS.theme)}`,
                );
                setPersonalDetails(randomPick(SURPRISE_TEMPLATES).slice(0, PERSONAL_DETAILS_MAX));
                toast.success("Surprise prompt loaded");
              }}
              className="h-12 shrink-0 gap-1.5 rounded-xl sm:h-14"
            >
              <Shuffle className="h-4 w-4" />
              Surprise me
            </Button>
          </div>
        </CollapsibleStep>

        {/* Step 2 — Name (repeated across the lyrics) */}
        <CollapsibleStep
          step={2}
          title="Name"
          done={!!subjectName.trim()}
          summary={subjectName.trim() ? `For ${subjectName.trim()}` : undefined}
        >
          <Label htmlFor="subject-name" className="sr-only">
            Who's this song for?
          </Label>
          <Input
            id="subject-name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value.slice(0, 60))}
            placeholder="Who's this song for? e.g. Aaliyah"
            maxLength={60}
            className="h-12 min-w-0 rounded-xl border-2 border-primary/30 bg-background/80 px-3 text-lg font-bold focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 sm:h-14 sm:text-xl"
          />
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            OG will weave{" "}
            <span className="text-foreground">
              {subjectName.trim() || "their name"}
            </span>{" "}
            through the hook and verses — heavy but never overpowering.
          </p>
        </CollapsibleStep>

        {/* Step 3 — Describe lyrics */}
        <CollapsibleStep
          step={3}
          title="Describe lyrics"
          done={personalDetails.trim().length >= 20}
          summary={
            personalDetails.trim()
              ? personalDetails.trim().slice(0, 90) +
                (personalDetails.trim().length > 90 ? "…" : "")
              : undefined
          }
        >
          {(() => {
            const check = personalDetailsCheck(personalDetails);
            const { status, message, pct, tone, barTone, length: len } = check;
            const invalid = status === "full" || status === "near";
            return (
              <div className="space-y-3">
                <Label htmlFor="personal-details" className="sr-only">
                  Describe
                </Label>
                <Textarea
                  id="personal-details"
                  aria-describedby="personal-details-help personal-details-count"
                  aria-invalid={invalid}
                  value={personalDetails}
                  onChange={(e) =>
                    setPersonalDetails(e.target.value.slice(0, PERSONAL_DETAILS_MAX))
                  }
                  placeholder="✍️ Who is this song for? Their name, what they love, your history, inside jokes…"
                  maxLength={PERSONAL_DETAILS_MAX}
                  rows={6}
                  className="min-h-[160px] resize-y rounded-xl border-primary/30 bg-background/60 text-base leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/40"
                />
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cn("h-full transition-all", barTone)}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs sm:text-sm">
                  <span
                    id="personal-details-help"
                    className={cn("min-w-0 flex-1 truncate font-medium", tone)}
                    aria-live="polite"
                  >
                    {message}
                  </span>
                  <span
                    id="personal-details-count"
                    className={cn("shrink-0 tabular-nums font-semibold", tone)}
                  >
                    {len}/{PERSONAL_DETAILS_MAX}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Hidden auto-filled lyric description for generation */}
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
        </CollapsibleStep>

        {/* Step 4 — Language */}
        <CollapsibleStep
          step={4}
          title="Language"
          done={!!selections.language}
          summary={selections.language || undefined}
        >
          <CategoryCard
            cat="language"
            value={selections.language}
            chips={chips.language}
            onSelect={(v) => setField("language", v)}
            onPickChip={(v) => pickChip("language", v)}
            onRefresh={() => refreshRow("language")}
          />
        </CollapsibleStep>

        {/* Step 5 — Song style */}
        <CollapsibleStep
          step={5}
          title="Song style"
          done={hasStyle}
          summary={
            hasStyle
              ? `${styleText.trim().slice(0, 90)}${styleText.trim().length > 90 ? "…" : ""}`
              : undefined
          }
        >
          <StyleComposer value={styleText} onChange={setStyleText} />
        </CollapsibleStep>

        {/* Foul mouth + Generate */}
        <div className="space-y-4">
          <FoulMouthToggle disabled={genLyrics} />


          <div id="lyrics-section" className="relative scroll-mt-24">
            <Button
              onClick={generateLyrics}
              disabled={!canGenerateLyrics || genLyrics}
              size="lg"
              className="h-14 w-full gap-2 rounded-2xl bg-gradient-brand text-base font-black text-primary-foreground shadow-glow ring-1 ring-primary/40 transition-transform hover:scale-[1.01] sm:h-20 sm:gap-2.5 sm:text-2xl"
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
                {balance < lyricsCost
                  ? `Not enough coins — needs ${lyricsCost}, you have ${balance}`
                  : !title.trim()
                    ? `Add a title to unlock · costs ${lyricsCost} coin${lyricsCost === 1 ? "" : "s"}`
                    : !subjectName.trim()
                      ? `Add a name so we can weave it into the lyrics · costs ${lyricsCost} coin${lyricsCost === 1 ? "" : "s"}`
                      : !selections.language
                        ? `Pick a language to unlock · costs ${lyricsCost} coin${lyricsCost === 1 ? "" : "s"}`
                        : `Add at least one style chip or type your own · costs ${lyricsCost} coin${lyricsCost === 1 ? "" : "s"}`}
              </p>
            )}
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
              <p className="text-sm font-bold">Your lyrics</p>
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

          <div className="flex flex-col items-end gap-2 rounded-2xl border border-white/10 bg-background/40 p-4">
            <Button
              onClick={() => setReviewOpen(true)}
              disabled={genSong || balance < previewCost || !lyrics.trim()}
              size="lg"
              className="gap-2 bg-gradient-brand text-primary-foreground shadow-glow"
            >
              {genSong ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Review & make the song · -{previewCost} coin{previewCost === 1 ? "" : "s"}
            </Button>
            <p className="text-xs font-medium text-muted-foreground">
              {balance < previewCost
                ? `Not enough coins — needs ${previewCost}, you have ${balance}`
                : `Costs ${previewCost} coin${previewCost === 1 ? "" : "s"} · balance ${balance}`}
            </p>
          </div>
        </section>
      )}

      <PoweredByOgBot />

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
        subjectName={subjectName}
        selections={selections}
        styleText={styleText}
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

