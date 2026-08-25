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
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  improveLyricDescription,
  listSongBriefDrafts,
  deleteSongBriefDraft,
  updateSongBriefDraft,
} from "@/lib/improve-description.functions";

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
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const improveDescription = useServerFn(improveLyricDescription);
  const listDrafts = useServerFn(listSongBriefDrafts);
  const deleteDraft = useServerFn(deleteSongBriefDraft);
  const updateDraft = useServerFn(updateSongBriefDraft);
  const draftsQuery = useInfiniteQuery({
    queryKey: ["song-brief-drafts"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listDrafts({ data: { offset: pageParam } }),
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    staleTime: 30_000,
  });
  const allDrafts = useMemo(
    () => draftsQuery.data?.pages.flatMap((p) => p.drafts) ?? [],
    [draftsQuery.data],
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Build one consistent brief that fills BOTH the style prompt and the lyrics
  // description in the same shape every time Improve succeeds.
  const buildBrief = (improved: string) => {
    const clean = improved.replace(/\s+/g, " ").trim();
    const style = `Style: ${clean}`.slice(0, 400);
    const lyrics = `Style: ${clean}\nLyrics brief: ${clean}`.slice(0, 1000);
    return { style, lyrics, clean };
  };
  const applyDraft = (d: { improved_text: string; subject_name: string | null }) => {
    const { style, lyrics, clean } = buildBrief(d.improved_text);
    setPersonalDetails(clean.slice(0, PERSONAL_DETAILS_MAX));
    setExtraContext(lyrics);
    setStyleText(style);
    if (d.subject_name && !subjectName.trim()) setSubjectName(d.subject_name.slice(0, 60));
    toast.success("Loaded saved brief — style & lyrics filled in");
  };
  const removeDraft = async (id: string) => {
    try {
      await deleteDraft({ data: { id } });
      await draftsQuery.refetch();
    } catch (err) {
      toast.error((err as Error).message || "Couldn't delete");
    }
  };
  const startEdit = (d: { id: string; improved_text: string }) => {
    setEditingId(d.id);
    setEditingText(d.improved_text);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };
  const saveEdit = async () => {
    if (!editingId) return;
    const next = editingText.trim();
    if (!next) {
      toast.info("Brief can't be empty");
      return;
    }
    setSavingEdit(true);
    try {
      await updateDraft({ data: { id: editingId, improvedText: next } });
      await draftsQuery.refetch();
      toast.success("Brief updated");
      cancelEdit();
    } catch (err) {
      toast.error((err as Error).message || "Couldn't save");
    } finally {
      setSavingEdit(false);
    }
  };
  const handleImproveDescription = async () => {
    const text = personalDetails.trim();
    if (!text || improving) return;
    if (text.length < 8) {
      toast.info("Write a few words first, then tap Improve.");
      return;
    }
    setImproving(true);
    setImproveError(null);
    try {
      const { improved } = await improveDescription({
        data: { text, subjectName: subjectName.trim() || undefined },
      });
      const { style, lyrics, clean } = buildBrief(improved);
      setPersonalDetails(clean.slice(0, PERSONAL_DETAILS_MAX));
      setExtraContext(lyrics);
      setStyleText(style);
      toast.success("Polished ✨ — style & lyrics prompt filled in");
      draftsQuery.refetch();
    } catch (err) {
      setImproveError((err as Error).message || "Couldn't improve just now");
    } finally {
      setImproving(false);
    }
  };
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

  /* ------------------------------------------------------------------
   * One-tap pipeline: lyrics → save → kick off Suno preview → navigate.
   * The user sees a single progress bar with a live ETA while everything
   * happens in the backend, then lands on the song page for the sample.
   * ------------------------------------------------------------------ */
  type PipelineStage =
    | "idle"
    | "lyrics"
    | "saving"
    | "submitting"
    | "rendering"
    | "error";
  const PIPELINE_ORDER: PipelineStage[] = ["lyrics", "saving", "submitting", "rendering"];
  // Baseline per-stage ETAs (ms) — recalibrated live from real timings below.
  const BASE_STAGE_ETA: Record<Exclude<PipelineStage, "idle" | "error">, number> = {
    lyrics: 18_000,
    saving: 1_500,
    submitting: 4_500,
    rendering: 60_000,
  };

  type PipelineState = {
    stage: PipelineStage;
    startedAt: number;
    stageStartedAt: number;
    durations: Partial<Record<PipelineStage, number>>;
    error?: string;
  };
  const [pipeline, setPipeline] = useState<PipelineState>({
    stage: "idle",
    startedAt: 0,
    stageStartedAt: 0,
    durations: {},
  });
  const [pipelineNow, setPipelineNow] = useState(0);
  const pipelineLockRef = useRef(false);
  const totalCost = lyricsCost + previewCost;
  const canRunPipeline =
    !!user && canGenerateLyrics && balance >= totalCost && pipeline.stage === "idle";

  useEffect(() => {
    if (pipeline.stage === "idle" || pipeline.stage === "error") return;
    setPipelineNow(Date.now());
    const id = window.setInterval(() => setPipelineNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [pipeline.stage, pipeline.stageStartedAt]);

  const advanceStage = (next: PipelineStage) => {
    setPipeline((p) => {
      const now = Date.now();
      const prev = p.stage;
      const durations = { ...p.durations };
      if (prev !== "idle" && prev !== "error") {
        durations[prev] = now - p.stageStartedAt;
      }
      return { ...p, stage: next, stageStartedAt: now, durations };
    });
  };

  async function createSong() {
    if (pipelineLockRef.current) return;
    if (!user || !canRunPipeline) return;
    pipelineLockRef.current = true;
    const startedAt = Date.now();
    setPipeline({ stage: "lyrics", startedAt, stageStartedAt: startedAt, durations: {} });
    setPipelineNow(startedAt);
    try {
      const description = styleText.trim();
      const combinedExtra = extraContext.trim();
      const { data: lyricData, error: lyricErr } = await supabase.functions.invoke("generate-lyrics", {
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
      if (lyricErr) throw new Error(invokeError(lyricErr, "Lyrics generation failed"));
      const nextLyrics = (lyricData?.lyrics ?? "").toString();
      if (!nextLyrics) throw new Error("No lyrics returned");
      setLyrics(nextLyrics);

      advanceStage("saving");
      const style = styleText.trim();
      const promptText = [
        title.trim(),
        subjectName.trim() ? `For: ${subjectName.trim()}` : null,
        style ? `Style: ${style}` : null,
        selections.language ? `Language: ${selections.language}` : null,
      ].filter(Boolean).join(" — ");

      const { data: row, error: insertErr } = await supabase
        .from("songs")
        .insert({
          user_id: user.id,
          title: title.trim() || null,
          prompt: promptText || title.trim() || "Untitled",
          style: style || null,
          lyrics: nextLyrics,
          status: "draft",
          extra_context: extraContext.trim() || null,
        } as never)
        .select("id")
        .single();
      if (insertErr || !row?.id) throw new Error(insertErr?.message || "Couldn't save song");

      advanceStage("submitting");
      const { error: genErr } = await supabase.functions.invoke("suno-generate", {
        body: {
          song_id: row.id,
          prompt: promptText,
          lyrics: nextLyrics,
          title: title.trim() || null,
          style: style || null,
        },
      });
      if (genErr) throw new Error(invokeError(genErr, "Could not start generation"));

      advanceStage("handoff");
      toast.success(`Cooking your sample · -${totalCost} coins`);
      navigate({ to: "/library/$songId", params: { songId: row.id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setPipeline((p) => ({ ...p, stage: "error", error: msg }));
      toast.error(msg);
    } finally {
      pipelineLockRef.current = false;
    }
  }

  const pipelineActive = pipeline.stage !== "idle" && pipeline.stage !== "error";
  const currentStage = pipeline.stage as Exclude<PipelineStage, "idle" | "error">;
  const stageElapsed = pipelineActive ? Math.max(0, pipelineNow - pipeline.stageStartedAt) : 0;

  // Adaptive ETA: use real durations from completed stages to scale future estimates.
  const doneList = PIPELINE_ORDER.filter((s) => pipeline.durations[s] != null);
  const calibration = (() => {
    if (doneList.length === 0) return 1;
    let actual = 0, base = 0;
    for (const s of doneList) {
      actual += pipeline.durations[s] ?? 0;
      base += BASE_STAGE_ETA[s as keyof typeof BASE_STAGE_ETA];
    }
    if (base <= 0) return 1;
    return Math.max(0.4, Math.min(2.5, actual / base));
  })();

  const currentBaseline = pipelineActive ? BASE_STAGE_ETA[currentStage] * calibration : 0;
  const currentRemaining = Math.max(0, currentBaseline - stageElapsed);
  const currentIdx = PIPELINE_ORDER.indexOf(currentStage);
  const futureRemaining = pipelineActive
    ? PIPELINE_ORDER.slice(currentIdx + 1).reduce(
        (sum, s) => sum + BASE_STAGE_ETA[s as keyof typeof BASE_STAGE_ETA] * calibration,
        0,
      )
    : 0;
  const totalRemaining = currentRemaining + futureRemaining;
  const totalBudget = PIPELINE_ORDER.reduce(
    (sum, s) => sum + BASE_STAGE_ETA[s as keyof typeof BASE_STAGE_ETA] * calibration,
    0,
  );
  const totalElapsed = pipelineActive ? Math.max(0, pipelineNow - pipeline.startedAt) : 0;
  const pipelinePct = pipelineActive
    ? Math.min(97, Math.round((totalElapsed / Math.max(1, totalBudget)) * 100))
    : 0;
  const pipelineEtaLabel =
    pipeline.stage === "handoff"
      ? "Opening your sample…"
      : totalRemaining > 1000
        ? `~${Math.ceil(totalRemaining / 1000)}s left`
        : "Almost there…";
  const pipelineStageLabel: Record<PipelineStage, string> = {
    idle: "",
    lyrics: "Writing lyrics around your details",
    saving: "Saving your track",
    submitting: "Sending to the studio",
    handoff: "Loading your sample player",
    error: "Something went wrong",
  };
  const pipelineStageTitle: Record<Exclude<PipelineStage, "idle" | "error">, string> = {
    lyrics: "Writing lyrics",
    saving: "Saving",
    submitting: "Studio",
    handoff: "Sample",
  };



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
                  placeholder="✍️ What's this song about? Vibes, memories, inside jokes, moments you want in the lyrics…"
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
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={handleImproveDescription}
                    disabled={improving || personalDetails.trim().length < 8}
                    className="gap-2 bg-gradient-brand text-primary-foreground shadow-glow"
                  >
                    {improving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    {improving ? "Improving…" : "Improve"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Type a few words — OG will tighten it into a lyrics-ready brief.
                  </span>
                </div>
                {improveError && (
                  <div
                    role="alert"
                    className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="mr-1">Improve failed:</strong>
                      {improveError}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleImproveDescription}
                        disabled={improving}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        {improving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3" />
                        )}
                        Retry
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setImproveError(null)}
                        className="h-7 px-2 text-xs"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {(draftsQuery.isLoading || allDrafts.length > 0) && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Saved briefs · tap to reuse
                </div>
                {draftsQuery.isFetching && !draftsQuery.isFetchingNextPage && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
              {draftsQuery.isLoading ? (
                <div className="space-y-1.5">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {allDrafts.map((d) => {
                    const isEditing = editingId === d.id;
                    return (
                      <li
                        key={d.id}
                        className="group flex items-start gap-2 rounded-lg border border-white/10 bg-card/60 p-2"
                      >
                        {isEditing ? (
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <Textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value.slice(0, 2000))}
                              rows={3}
                              className="text-xs"
                              autoFocus
                            />
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                onClick={saveEdit}
                                disabled={savingEdit || !editingText.trim()}
                                className="h-7 gap-1 px-2 text-xs"
                              >
                                {savingEdit ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                disabled={savingEdit}
                                className="h-7 gap-1 px-2 text-xs"
                              >
                                <X className="h-3 w-3" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => applyDraft(d)}
                              className="min-w-0 flex-1 text-left text-xs leading-snug hover:text-primary"
                            >
                              {d.subject_name && (
                                <span className="mr-1 font-semibold text-foreground">
                                  {d.subject_name} ·
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                {d.improved_text.slice(0, 140)}
                                {d.improved_text.length > 140 ? "…" : ""}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(d)}
                              aria-label="Edit saved brief"
                              className="shrink-0 rounded p-1 text-muted-foreground opacity-60 hover:bg-primary/10 hover:text-primary hover:opacity-100"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDraft(d.id)}
                              aria-label="Delete saved brief"
                              className="shrink-0 rounded p-1 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {draftsQuery.hasNextPage && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => draftsQuery.fetchNextPage()}
                  disabled={draftsQuery.isFetchingNextPage}
                  className="h-7 w-full gap-1 text-xs"
                >
                  {draftsQuery.isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              )}
            </div>
          )}


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

        {/* Foul mouth + one-tap create */}
        <div className="space-y-4">
          <FoulMouthToggle disabled={pipelineActive} />

          <div id="lyrics-section" className="relative scroll-mt-24">
            <Button
              onClick={createSong}
              disabled={!canRunPipeline}
              size="lg"
              className="h-14 w-full gap-2 rounded-2xl bg-gradient-brand text-base font-black text-primary-foreground shadow-glow ring-1 ring-primary/40 transition-transform hover:scale-[1.01] sm:h-20 sm:gap-2.5 sm:text-2xl"
            >
              {pipelineActive ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              {pipelineActive ? "Cooking your sample…" : `Create my song · -${totalCost}`}
            </Button>
            {!canRunPipeline && pipeline.stage === "idle" && (
              <p className="mt-3 text-center text-sm font-medium text-muted-foreground">
                {balance < totalCost
                  ? `Not enough coins — needs ${totalCost}, you have ${balance}`
                  : !title.trim()
                    ? `Add a title to unlock · costs ${totalCost} coin${totalCost === 1 ? "" : "s"}`
                    : !subjectName.trim()
                      ? `Add a name so we can weave it into the track · costs ${totalCost} coin${totalCost === 1 ? "" : "s"}`
                      : !selections.language
                        ? `Pick a language to unlock · costs ${totalCost} coin${totalCost === 1 ? "" : "s"}`
                        : `Add at least one style chip or type your own · costs ${totalCost} coin${totalCost === 1 ? "" : "s"}`}
              </p>
            )}
            {pipeline.stage === "idle" && canRunPipeline && (
              <p className="mt-3 text-center text-xs font-medium text-muted-foreground">
                Lyrics + free sample happen in the backend · ~25 seconds
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Live status bar — one-tap pipeline progress */}
      {(pipelineActive || pipeline.stage === "error") && (
        <section
          role="status"
          aria-live="polite"
          className="space-y-4 rounded-3xl border border-primary/40 bg-card/70 p-5 shadow-glow backdrop-blur-xl sm:p-7"
        >
          {/* Hero: the current stage is the main event */}
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/20 text-primary shadow-glow">
              {pipeline.stage === "error" ? (
                <X className="h-7 w-7" />
              ) : (
                <Loader2 className="h-7 w-7 animate-spin" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {pipeline.stage === "error"
                    ? "Stopped"
                    : `Step ${Math.max(1, currentIdx + 1)} of ${PIPELINE_ORDER.length}`}
                </p>
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-black text-primary">
                  {pipeline.stage === "error" ? "Retry" : pipelineEtaLabel}
                </span>
              </div>
              <h3 className="mt-1 text-xl font-black leading-tight sm:text-2xl">
                {pipeline.stage === "error"
                  ? "Generation stopped"
                  : pipelineStageTitle[currentStage]}
              </h3>
              <p className="text-sm text-muted-foreground">
                {pipeline.stage === "error"
                  ? pipeline.error || "Please try again."
                  : pipelineStageLabel[pipeline.stage]}
              </p>
            </div>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300 ease-out",
                pipeline.stage === "error"
                  ? "bg-destructive/80"
                  : "bg-gradient-to-r from-primary via-accent to-primary",
              )}
              style={{ width: `${pipeline.stage === "error" ? 100 : pipelinePct}%` }}
            />
          </div>

          {/* Collapsed past/future — a tight strip of dots + one label per side */}
          {pipeline.stage !== "error" && (
            <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3 w-3 text-primary" />
                {currentIdx === 0 ? "Just started" : `${currentIdx} done`}
              </span>
              <div className="flex items-center gap-1" aria-hidden>
                {PIPELINE_ORDER.map((s, i) => (
                  <span
                    key={s}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i < currentIdx && "w-4 bg-primary/70",
                      i === currentIdx && "w-8 bg-primary animate-pulse",
                      i > currentIdx && "w-2 bg-white/15",
                    )}
                  />
                ))}
              </div>
              <span>
                {currentIdx >= PIPELINE_ORDER.length - 1
                  ? "Wrapping up"
                  : `Next · ${pipelineStageTitle[PIPELINE_ORDER[currentIdx + 1] as keyof typeof pipelineStageTitle]}`}
              </span>
            </div>
          )}

          {pipeline.stage === "error" && (
            <Button
              onClick={() => {
                setPipeline({ stage: "idle", startedAt: 0, stageStartedAt: 0, durations: {} });
                setPipelineNow(0);
              }}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          )}
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

