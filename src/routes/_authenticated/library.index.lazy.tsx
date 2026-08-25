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
import {
  CreateNowWizard,
  EMPTY_DRAFT,
  type WizardDraft,
} from "@/components/library/CreateNowWizard";
import { CommunityTrackRow } from "@/components/library/CommunityTrackRow";
import { GenerationHistory } from "@/components/library/GenerationHistory";
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



const MIN_TRACK_MINUTES = 3;

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

  const [wizardOpen, setWizardOpen] = useState(false);
  // Last raw wizard answers — kept so a retry (or reopening the wizard after a
  // failure) never loses what the user already typed.
  const [wizardDraft, setWizardDraft] = useState<WizardDraft>(EMPTY_DRAFT);
  const statusPanelRef = useRef<HTMLElement | null>(null);
  const libraryRef = useRef<HTMLElement | null>(null);
  // Track length: a 3-minute floor is enforced backend-side; users may raise it.
  const [targetMinutes, setTargetMinutes] = useState(MIN_TRACK_MINUTES);
  const targetDurationSec = Math.max(MIN_TRACK_MINUTES, targetMinutes) * 60;
  const expectedRange = `${targetMinutes}:00–${targetMinutes}:30+`;
  // Actual estimate returned by the lyrics engine once a track is generated.
  const [actualDurationLabel, setActualDurationLabel] = useState<string | null>(null);



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
          targetDurationSec,
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
  // The song we're watching in realtime while its audio renders.
  const [trackedSongId, setTrackedSongId] = useState<string | null>(null);
  const [freshTrack, setFreshTrack] = useState<Song | null>(null);

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

  const pipelineRunRef = useRef(0);

  function resetPipeline() {
    setPipeline({ stage: "idle", startedAt: 0, stageStartedAt: 0, durations: {} });
    setPipelineNow(0);
  }

  /** Cancel an in-progress generation and clear the realtime status UI. */
  function cancelGeneration() {
    pipelineRunRef.current += 1;
    pipelineLockRef.current = false;
    setTrackedSongId(null);
    resetPipeline();
    toast.info("Generation cancelled — the status panel is cleared");
  }

  /* Watchdog: if a stage hangs (provider outage, lost callback) we surface a
   * clear timeout error instead of spinning forever. Inputs stay in state so
   * the retry button can re-run the exact same request. */
  const STAGE_TIMEOUT_MS: Record<string, number> = {
    lyrics: 120_000,
    saving: 30_000,
    submitting: 60_000,
    rendering: 360_000,
  };
  useEffect(() => {
    const limit = STAGE_TIMEOUT_MS[pipeline.stage];
    if (!limit) return;
    const id = window.setTimeout(() => {
      pipelineRunRef.current += 1;
      pipelineLockRef.current = false;
      setTrackedSongId(null);
      const which = pipeline.stage === "lyrics" ? "Lyrics generation" : "The studio";
      setPipeline((p) => ({
        ...p,
        stage: "error",
        error: `${which} timed out. Nothing was lost — your details are saved, tap Try again.`,
      }));
      toast.error("Timed out — tap Try again, your details are saved");
    }, limit);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.stage, pipeline.stageStartedAt]);


  type CreateOverrides = {
    title: string;
    subjectName: string;
    description: string;
    style: string;
    language: string;
  };

  // Keeps the exact payload of the last run so "Try again" reuses it verbatim.
  const [lastOverrides, setLastOverrides] = useState<CreateOverrides | null>(null);

  async function createSong(override?: CreateOverrides) {
    if (pipelineLockRef.current) return;
    if (!user) return;
    if (override) {
      if (balance < totalCost) {
        toast.error(`Need ${totalCost} coins to create a song`);
        return;
      }
      setLastOverrides(override);
    } else if (!canRunPipeline) {
      return;
    }

    const songTitle = (override?.title ?? title).trim();
    const songSubject = (override?.subjectName ?? subjectName).trim();
    const songStyle = (override?.style ?? styleText).trim();
    const songLanguage = (override?.language ?? selections.language ?? "English").trim();
    const songDetails = (override?.description ?? personalDetails).trim();
    const songStyleTags = override
      ? [override.style].filter(Boolean)
      : styleTags;
    pipelineLockRef.current = true;
    const runId = ++pipelineRunRef.current;
    const stale = () => pipelineRunRef.current !== runId;
    const startedAt = Date.now();
    setPipeline({ stage: "lyrics", startedAt, stageStartedAt: startedAt, durations: {} });
    setPipelineNow(startedAt);

    try {
      const description = songStyle;
      const combinedExtra = extraContext.trim();
      const { data: lyricData, error: lyricErr } = await supabase.functions.invoke("generate-lyrics", {
        body: {
          songName: songTitle,
          description,
          styleTags: songStyleTags,
          language: songLanguage,
          foulMouth,
          personalDetails: songDetails || undefined,
          extraContext: combinedExtra || undefined,
          subjectName: songSubject || undefined,
          targetDurationSec,
        },
      });
      if (stale()) return;
      if (lyricErr) throw new Error(invokeError(lyricErr, "Lyrics generation failed"));
      setActualDurationLabel(
        (lyricData?.estimated_duration_label ?? null) as string | null,
      );
      const nextLyrics = (lyricData?.lyrics ?? "").toString();
      if (!nextLyrics) throw new Error("No lyrics returned");
      setLyrics(nextLyrics);

      advanceStage("saving");
      const style = songStyle;
      const promptText = [
        songTitle,
        songSubject ? `For: ${songSubject}` : null,
        style ? `Style: ${style}` : null,
        songLanguage ? `Language: ${songLanguage}` : null,
      ].filter(Boolean).join(" — ");


      const { data: row, error: insertErr } = await supabase
        .from("songs")
        .insert({
          user_id: user.id,
          title: songTitle || null,
          prompt: promptText || songTitle || "Untitled",
          style: style || null,
          lyrics: nextLyrics,
          status: "draft",
          extra_context: extraContext.trim() || null,
        } as never)
        .select("id")
        .single();
      if (stale()) return;
      if (insertErr || !row?.id) throw new Error(insertErr?.message || "Couldn't save song");

      advanceStage("submitting");
      const { error: genErr } = await supabase.functions.invoke("suno-generate", {
        body: {
          song_id: row.id,
          prompt: promptText,
          lyrics: nextLyrics,
          title: songTitle || null,
          style: style || null,
        },
      });
      if (stale()) return;
      if (genErr) throw new Error(invokeError(genErr, "Could not start generation"));

      // Stay on the page: a realtime subscription on this row drives the
      // status indicator until the track is ready (or fails).
      advanceStage("rendering");
      setTrackedSongId(row.id);
      library.refetch();
      toast.success(`Cooking your sample · -${totalCost} coins`);

    } catch (e) {
      if (stale()) return;
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
    totalRemaining > 1000 ? `~${Math.ceil(totalRemaining / 1000)}s left` : "Almost there…";
  const pipelineStageLabel: Record<PipelineStage, string> = {
    idle: "",
    lyrics: "Writing lyrics around your details",
    saving: "Saving your track",
    submitting: "Sending to the studio",
    rendering: "Rendering your audio — this page updates the moment it's ready",
    error: "Something went wrong",
  };
  const pipelineStageTitle: Record<Exclude<PipelineStage, "idle" | "error">, string> = {
    lyrics: "Writing lyrics",
    saving: "Saving",
    submitting: "Studio",
    rendering: "Rendering audio",
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

  /* ------------------------------------------------------------------
   * Realtime generation status: watch the song we just submitted and flip
   * the indicator the instant the backend marks it completed or failed.
   * Falls back to a slow poll in case a realtime event is missed.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!trackedSongId) return;
    let cancelled = false;

    const settle = (row: Song) => {
      if (cancelled) return;
      if (row.status === "completed") {
        setFreshTrack(row);
        setPipeline({ stage: "idle", startedAt: 0, stageStartedAt: 0, durations: {} });
        setTrackedSongId(null);
        library.refetch();
        setReadyToReview({ id: row.id, title: row.title || "Your song" });
        notifiedReadyRef.current.add(row.id);
        toast.success(`🎧 Song is ready · ${row.title || "Your song"}`, {
          id: `song-ready-${row.id}`,
          duration: 12000,
        });
      } else if (row.status === "failed") {
        setPipeline((p) => ({
          ...p,
          stage: "error",
          error: "The studio couldn't finish this track. Your coins for a failed render are refunded automatically.",
        }));
        setTrackedSongId(null);
        library.refetch();
        toast.error("Generation failed — please try again");
      }
    };

    const ch = supabase
      .channel(`song-status-${trackedSongId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "songs", filter: `id=eq.${trackedSongId}` },
        (payload) => settle(payload.new as Song),
      )
      .subscribe();

    const poll = window.setInterval(async () => {
      const { data } = await supabase
        .from("songs")
        .select("*")
        .eq("id", trackedSongId)
        .maybeSingle();
      if (data) settle(data as Song);
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedSongId]);


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
          <p className="mt-1 text-sm font-semibold text-muted-foreground sm:text-base">
            Create your track in minutes.
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-card/60 px-4 py-2 shadow-[0_8px_28px_-12px_oklch(0.7_0.2_300_/_0.45)]">
          <Coins className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-lg font-black tabular-nums sm:text-xl">{balance}</span>
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:inline">coins</span>
        </div>
      </header>

      {/* Primary entry points — create, or jump straight to the library */}
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            onClick={() => setWizardOpen(true)}
            disabled={pipelineActive}
            className="min-h-14 w-full gap-2 rounded-2xl bg-gradient-brand text-base font-black uppercase tracking-[0.14em] text-primary-foreground shadow-glow sm:text-lg"
          >
            <Sparkles className="h-5 w-5" />
            {pipelineActive ? "Cooking your track…" : "Create now"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              libraryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="min-h-14 w-full gap-2 rounded-2xl border-primary/40 text-base font-black uppercase tracking-[0.14em] sm:text-lg"
          >
            <Disc3 className="h-5 w-5" />
            Library
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Five quick steps · -{totalCost} coins · expected length {expectedRange}
          </p>
          <FoulMouthToggle disabled={pipelineActive} />
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/25 bg-card/50 p-3">
          <Label htmlFor="target-length" className="text-xs font-black uppercase tracking-[0.16em]">
            Track length
          </Label>
          <select
            id="target-length"
            value={targetMinutes}
            onChange={(e) => setTargetMinutes(Number(e.target.value))}
            disabled={pipelineActive}
            className="min-h-10 rounded-xl border border-primary/30 bg-background/70 px-3 text-sm font-semibold disabled:opacity-60"
          >
            {[3, 4, 5, 6, 8].map((m) => (
              <option key={m} value={m}>
                {m} min minimum{m === 3 ? " (default)" : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Minimum {MIN_TRACK_MINUTES} min is enforced — no upper limit, tracks can run longer.
          </span>
        </div>
      </div>



      <CreateNowWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialDraft={wizardDraft}
        submitLabel={`Create · -${totalCost}`}
        onComplete={(v, draft) => {
          setWizardDraft(draft);
          setTitle(v.title);
          setSubjectName(v.subjectName);
          setPersonalDetails(v.description.slice(0, PERSONAL_DETAILS_MAX));
          setStyleText(v.style);
          setSelections({ language: v.language });
          toast.success("Track created — generating lyrics…");
          void createSong(v);
          // Bring the live status panel into view right after the toast.
          window.setTimeout(
            () => statusPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
            250,
          );
        }}
      />


      <GenerationHistory songs={versionedLibrary} loading={library.isFetching} />


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
            <p className="mt-0.5 text-[11px] text-emerald-200/90">
              Expected length {actualDurationLabel ?? expectedRange}
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



      {/* Creation happens entirely inside the Create now wizard — no inline form. */}


      {/* Live status bar — one-tap pipeline progress */}
      {(pipelineActive || pipeline.stage === "error") && (
        <section
          ref={statusPanelRef}
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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  resetPipeline();
                  void createSong(lastOverrides ?? undefined);
                }}
                size="sm"
                className="gap-2 bg-gradient-brand font-black uppercase tracking-wide text-primary-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
              <Button
                type="button"
                onClick={() => {
                  resetPipeline();
                  setWizardOpen(true);
                }}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" /> Edit details
              </Button>
              <Button type="button" onClick={resetPipeline} size="sm" variant="ghost" className="gap-2">
                <X className="h-3.5 w-3.5" /> Dismiss
              </Button>
            </div>
          )}


          {pipelineActive && (
            <Button
              type="button"
              onClick={cancelGeneration}
              size="sm"
              variant="outline"
              className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              <X className="h-3.5 w-3.5" /> Cancel generation
            </Button>
          )}
        </section>
      )}

      {/* Fresh track preview — appears automatically the moment a generation completes */}
      {freshTrack && (
        <section
          aria-label="Newly finished track"
          className="space-y-3 rounded-3xl border border-emerald-400/40 bg-emerald-500/5 p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">
              Just finished · preview
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setFreshTrack(null)}
              className="h-8 px-2 text-xs"
            >
              Hide
            </Button>
          </div>
          <Link
            to="/library/$songId"
            params={{ songId: freshTrack.id }}
            className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SongCard song={freshTrack} />
          </Link>
          <Link to="/library/$songId" params={{ songId: freshTrack.id }} className="block">
            <Button type="button" className="min-h-12 w-full gap-2 rounded-2xl bg-gradient-brand font-black uppercase tracking-[0.12em] text-primary-foreground shadow-glow">
              <Sparkles className="h-4 w-4" /> Play sample · unlock full track
            </Button>
          </Link>
        </section>
      )}



      {/* Library — luxury two-tab vault: Yours first, then Community */}
      <section ref={libraryRef} id="library" className="scroll-mt-24">
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
                  <div className="space-y-2">
                    <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card/30">
                      {filtered.map((s) => (
                        <CommunityTrackRow key={s.id} song={s} />
                      ))}
                    </ul>
                    <div ref={communitySentinelRef} className="h-1" aria-hidden />
                    {community.isFetchingNextPage && (
                      <div className="grid gap-2">
                        {[0, 1].map((i) => (
                          <SongCardSkeleton key={`more-${i}`} label="Loading" />
                        ))}
                      </div>
                    )}
                    {!community.hasNextPage && (
                      <p className="py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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

