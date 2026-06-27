import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  EXAMPLE_PROMPT_CHIPS,
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
import { FoulMouthReminder } from "@/components/FoulMouthReminder";
import { PoweredByOgBot } from "@/components/PoweredByOgBot";
import { JobQueuePanel } from "@/components/library/JobQueuePanel";
import { CategoryCard } from "@/components/library/CategoryCard";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";

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



export const Route = createFileRoute("/_authenticated/library/")({
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
  const [selections, setSelections] = useState<Selections>({});
  const [chips, setChips] = useState<Record<Category, string[]>>(() => initialChips());
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
  const [communitySearch, setCommunitySearch] = useState("");

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
  const progress = Math.min(100, Math.round((totalFilled / 4) * 100));

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
      // Backend enforces global + per-user concurrency limits (returns 429 when over capacity).
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-20">
      {/* Hero — premium kicker, oversized headline, generous breathing room */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 pb-4">
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

      {/* Persistent Foul Mouth reminder — one tap takes you to the toggle */}
      <div className="sticky top-14 z-20 -mx-4 px-4 sm:top-16 sm:-mx-6 sm:px-6">
        <FoulMouthReminder
          enabled={foulMouth}
          onAction={() => {
            const el = document.getElementById("foul-mouth-toggle");
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.focus({ preventScroll: true });
            }
            setFoulMouth((v) => !v);
          }}
        />
      </div>

      {/* Library — luxury two-tab vault: Yours first, then Community */}
      <section>
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">

          <div className="min-w-0 space-y-1">
            <div className="truncate text-xs font-bold uppercase tracking-[0.24em] text-primary">
              <Disc3 className="mr-1.5 inline h-3.5 w-3.5 -translate-y-0.5" />
              MusicHUB · Vault
            </div>
            <h2 className="truncate font-display text-2xl font-black tracking-tight sm:text-4xl">
              Your Library
            </h2>
            <p className="text-sm text-muted-foreground">
              Your tracks first. Community drops live in the next tab.
            </p>
          </div>
          {versionedLibrary.length > 0 && (
            <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {versionedLibrary.length} track{versionedLibrary.length === 1 ? "" : "s"}
            </span>
          )}
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
                return (
                  <div className="grid gap-3">
                    {genSong && <SongCardSkeleton label="Generating" />}
                    {filtered.length === 0 && !genSong ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No tracks match "{yoursSearch}".
                      </p>
                    ) : (
                      filtered.map((s) => (
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
                      ))
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
      <section className="flex flex-col gap-6 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/80 to-card/60 p-5 shadow-[0_24px_70px_-30px_oklch(0.7_0.2_300_/_0.5)] ring-1 ring-white/5 sm:gap-8 sm:p-8">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-white/10 pb-4">
          <h2 className="truncate font-display text-xl font-black tracking-tight sm:text-3xl">
            Create a song
          </h2>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {totalFilled}/4
          </span>
        </header>

        {/* Title */}
        <div className="space-y-3">
          <Label htmlFor="song-title" className="font-bungee text-2xl sm:text-3xl uppercase">
            Title
          </Label>
          <div className="flex flex-wrap items-stretch gap-2">
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
                setSelections({
                  language: randomPick(POOLS.language),
                  genre: randomPick(POOLS.genre),
                  mood: randomPick(POOLS.mood),
                  theme: randomPick(POOLS.theme),
                });
                setPersonalDetails(randomPick(SURPRISE_TEMPLATES).slice(0, PERSONAL_DETAILS_MAX));
                toast.success("Surprise prompt loaded");
              }}
              className="h-12 shrink-0 gap-1.5 rounded-xl sm:h-14"
            >
              <Shuffle className="h-4 w-4" />
              Surprise me
            </Button>
          </div>
        </div>

        {/* Personal details */}
        <div className="space-y-3">
          <Label htmlFor="personal-details" className="font-bungee text-2xl sm:text-3xl uppercase">
            Describe
          </Label>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Example prompts"
          >
            {EXAMPLE_PROMPT_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                aria-label={`Insert example: ${chip.label}`}
                onClick={() =>
                  setPersonalDetails((v) => {
                    const sep = v.length === 0 ? "" : v.endsWith("\n") ? "" : "\n";
                    return (v + sep + chip.snippet).slice(0, PERSONAL_DETAILS_MAX);
                  })
                }
                className="rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-1.5 text-sm font-semibold text-foreground/85 transition hover:border-primary/60 hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {chip.label}
              </button>
            ))}
          </div>
          {(() => {
            const check = personalDetailsCheck(personalDetails);
            const { status, message, pct, tone, barTone, length: len } = check;
            const invalid = status === "full" || status === "near";
            return (
              <>
                <Textarea
                  id="personal-details"
                  aria-describedby="personal-details-help personal-details-count"
                  aria-invalid={invalid}
                  value={personalDetails}
                  onChange={(e) => setPersonalDetails(e.target.value.slice(0, PERSONAL_DETAILS_MAX))}
                  placeholder="✍️ Who is this song for? Their name, what they love, your history, inside jokes…"
                  maxLength={PERSONAL_DETAILS_MAX}
                  rows={8}
                  className="min-h-[200px] resize-y rounded-xl border-primary/30 bg-background/60 text-base leading-relaxed placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/40"
                />
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cn("h-full transition-all", barTone)}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span id="personal-details-help" className={cn("min-w-0 truncate font-medium", tone)} aria-live="polite">{message}</span>
                  <span
                    id="personal-details-count"
                    className={cn("shrink-0 tabular-nums font-semibold", tone)}
                  >
                    {len}/{PERSONAL_DETAILS_MAX}
                  </span>
                </div>
              </>
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
        </div>

        {/* Sound categories */}
        <div className="space-y-3">
          <div className="font-bungee text-2xl sm:text-3xl uppercase">
            Sound
          </div>
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-5">
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
        </div>

        {/* Foul mouth + Generate */}
        <div className="space-y-4">
          {!foulMouth && (
            <div className="flex items-start gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-3 shadow-[0_0_28px_-10px_oklch(0.62_0.22_25_/_0.8)] sm:p-4">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-destructive/25 text-lg sm:h-10 sm:w-10">
                <Flame className="h-5 w-5 text-destructive" />
              </span>
              <div className="min-w-0 text-sm leading-snug sm:text-base">
                <p className="font-black uppercase tracking-wide text-destructive">Don't leave it on clean!</p>
                <p className="mt-0.5 text-foreground/85">Flip <span className="font-bold">Foul Mouth</span> on for the unfiltered, no-rules OG version. The clean one is just a demo.</p>
              </div>
            </div>
          )}
          <button
            id="foul-mouth-toggle"
            type="button"
            role="switch"
            aria-checked={foulMouth}
            aria-label="OG Foul Mouth — explicit lyrics mode"
            aria-describedby="foul-mouth-status"
            aria-busy={genLyrics}
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
              "relative group flex w-full min-h-14 items-center gap-2 rounded-2xl border-2 px-4 py-3 text-left transition-all sm:gap-3 sm:px-5 sm:py-4",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              foulMouth
                ? "border-destructive bg-destructive/15 shadow-[0_0_24px_-6px_oklch(0.62_0.22_25_/_0.6)]"
                : "border-white/15 bg-white/[0.04] hover:border-white/25",
            )}
          >
            <div aria-hidden="true" className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl transition sm:h-12 sm:w-12 sm:text-2xl",
              foulMouth ? "bg-destructive/30" : "bg-white/5",
            )}>
              {foulMouth ? "🤬" : "🧼"}
            </div>
            <div className="min-w-0 shrink">

              <div className="truncate text-sm font-bold leading-tight sm:text-lg">OG Foul Mouth</div>
              <div
                id="foul-mouth-status"
                aria-live="polite"
                className={cn(
                  "truncate text-xs leading-tight sm:text-sm",
                  foulMouth ? "font-semibold text-destructive-foreground/90" : "text-muted-foreground",
                )}
              >
                {foulMouth ? "Explicit · ON" : "Clean · tap to go explicit"}
              </div>
            </div>
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none inline-flex shrink-0 items-center justify-center rounded-full border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition sm:px-4 sm:py-2 sm:text-xs",
                foulMouth
                  ? "border-destructive bg-destructive text-destructive-foreground shadow-[0_0_18px_-4px_oklch(0.62_0.22_25_/_0.8)]"
                  : "border-white/25 bg-white/10 text-foreground",
              )}
            >
              {foulMouth ? "Turn off" : "Turn on"}
            </span>
          </button>

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
                Pick a language and at least one style detail above to unlock
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

