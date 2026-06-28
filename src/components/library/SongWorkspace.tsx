import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Loader2, FileText, Wand2,
  Coins, Check, Sparkles, Music2, AlertCircle, Play, RefreshCw,
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettings } from "@/hooks/use-settings";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";
import { useRole } from "@/hooks/use-role";

import { useProfile } from "@/hooks/use-profile";
import { useVariations } from "@/hooks/use-variations";
import { invokeError } from "@/lib/invoke-error";
import { cn } from "@/lib/utils";
import { CoinPill } from "@/components/ui/coin-pill";
import { StageStepper, type Stage } from "./song-workspace/StageStepper";
import { VariationsCard } from "./song-workspace/VariationsCard";
import type { WorkspaceSong } from "./song-workspace/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ogBotAsset from "@/assets/ogbot.png.asset.json";


const LANGUAGES = [
  "English", "Spanish", "French", "Portuguese", "Hindi", "Gujarati",
  "Marathi", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam",
  "Urdu", "Punjabi", "Arabic", "Swahili", "Patois", "Yoruba", "German",
  "Italian", "Filipino", "Tagalog", "Cebuano", "Mandarin", "Japanese",
  "Korean", "Turkish", "Russian", "Polish", "Dutch", "Greek", "Thai",
  "Vietnamese", "Indonesian", "Malay", "Hebrew",
];

const LANG_RE = /Language:\s*(?:write the lyrics in\s*)?([A-Za-z][A-Za-z\s]{1,30})/i;

function detectLanguage(text: string | null | undefined): string {
  const m = text?.match(LANG_RE);
  const found = m?.[1]?.trim();
  if (!found) return "English";
  return LANGUAGES.find((l) => l.toLowerCase() === found.toLowerCase()) ?? "English";
}

function setBriefLanguage(brief: string, language: string): string {
  const line = `Language: write the lyrics in ${language}`;
  if (LANG_RE.test(brief)) return brief.replace(LANG_RE, line);
  return brief.trim() ? `${brief.trim()}\n${line}` : line;
}

interface Props {
  song: WorkspaceSong;
  onSaved?: () => void;
  onRefresh?: () => void;
}

/**
 * 3-stage music creation workflow:
 *   1. Lyrics       — user crafts a brief and generates lyrics (charged)
 *   2. Sample       — generate a short preview of the full song (charged)
 *   3. Final song   — full track ready to play / download (uses preview unlock)
 * Edits at any stage can be re-sent and re-cost coins, same as every other AI message.
 */
export function SongWorkspace({ song, onSaved, onRefresh }: Props) {
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();
  const { foulMouth } = useFoulMouth();
  const setFoulMouth = useSetFoulMouth();

  const lyricsCost = settings?.coins_per_lyrics_generation ?? 1;
  const previewCost = settings?.coins_per_generation ?? 3;
  const fullUnlockCost = settings?.coins_per_full_unlock ?? 5;
  const balance = profile?.coin_balance ?? 0;
  const isOwner = !!profile?.id && song.user_id === profile.id;

  const [title, setTitle] = useState(song.title ?? "");
  const [brief, setBrief] = useState(song.prompt ?? "");
  const [lyrics, setLyrics] = useState(song.lyrics ?? "");
  const [language, setLanguage] = useState(() => detectLanguage(song.prompt));
  const { isVip } = useRole();
  const [saving, setSaving] = useState(false);
  const [genLyrics, setGenLyrics] = useState(false);
  const [genPreview, setGenPreview] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [missing, setMissing] = useState(false);
  const [recheckActive, setRecheckActive] = useState(false);
  const [recheckCount, setRecheckCount] = useState(0);

  useEffect(() => {
    if (!recheckActive) return;
    if (recheckCount >= 10) {
      setRecheckActive(false);
      return;
    }
    const id = setTimeout(() => {
      onRefresh?.();
      onSaved?.();
      setRecheckCount((c) => c + 1);
    }, 3000);
    return () => clearTimeout(id);
  }, [recheckActive, recheckCount, onRefresh, onSaved]);

  useEffect(() => {
    if (!missing && recheckActive) {
      setRecheckActive(false);
      setRecheckCount(0);
    }
  }, [missing, recheckActive]);

  const lyricsRef = useRef<HTMLTextAreaElement | null>(null);

  const briefLanguage = useMemo(() => detectLanguage(brief), [brief]);
  const languageChanged = language !== briefLanguage;


  const {
    variations, basket, busyVariation, checkingOut, variationCost,
    revealOne, toggleBasket, clearBasket, checkoutBasket,
  } = useVariations({
    songId: song.id,
    songStatus: song.status,
    balance,
    previewCost,
    onChanged: onSaved,
  });

  const hasLyrics = !!(lyrics && lyrics.trim().length > 20);
  const isPending = song.status === "pending" || song.status === "processing";
  const isReady = song.status === "completed";
  const isFailed = song.status === "failed";

  // Realtime + polling fallback: while the song is generating, listen for the row
  // flipping to completed/failed and ask the parent to refetch so the UI moves
  // from "Sample" → "Full ready" automatically.
  const lastStatus = useRef(song.status);
  useEffect(() => {
    if (!isPending) {
      if (lastStatus.current === "pending" || lastStatus.current === "processing") {
        if (isReady) toast.success("Sample ready — full track unlocked");
        else if (isFailed) toast.error(song.error_message || "Generation failed — coins refunded");
      }
      lastStatus.current = song.status;
      return;
    }
    lastStatus.current = song.status;

    const channel = supabase
      .channel(`song-${song.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "songs", filter: `id=eq.${song.id}` },
        (payload) => {
          const next = (payload.new as { status?: string })?.status;
          if (next && next !== lastStatus.current) onSaved?.();
        },
      )
      .subscribe();

    // Tight 2s polling fallback in case Realtime drops a message.
    const poll = setInterval(() => onSaved?.(), 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, song.status]);

  // Elapsed-seconds counter for the Generate button while a job is in flight.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isPending) { setElapsed(0); return; }
    const startedAt = song.generation_started_at
      ? new Date(song.generation_started_at).getTime()
      : Date.now();
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isPending, song.generation_started_at]);

  const stage: Stage = isReady ? 3 : hasLyrics ? 2 : 1;

  const dirty =
    title !== (song.title ?? "") ||
    brief !== (song.prompt ?? "") ||
    lyrics !== (song.lyrics ?? "");

  async function persist(patch: Partial<{ title: string | null; prompt: string; lyrics: string | null }>) {
    const { error } = await supabase.from("songs").update(patch).eq("id", song.id);
    if (error) throw error;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await persist({
        title: title.trim() || null,
        prompt: brief,
        lyrics: lyrics.trim() || null,
      });
      toast.success("Saved");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function generateLyrics() {
    if (missing) {
      toast.error("This song is no longer available");
      return;
    }
    if (!isOwner) {
      toast.error("This is a community song — open the studio to create your own");
      return;
    }
    if (!brief.trim() && !title.trim()) {
      toast.error("Add a title or a brief first");
      return;
    }
    if (balance < lyricsCost) {
      toast.error(`Need ${lyricsCost} coin${lyricsCost === 1 ? "" : "s"} — current balance ${balance}`);
      return;
    }
    setGenLyrics(true);
    try {
      const nextBrief = languageChanged ? setBriefLanguage(brief, language) : brief;
      if (nextBrief !== brief) setBrief(nextBrief);
      if (dirty || nextBrief !== (song.prompt ?? "")) {
        await persist({ title: title.trim() || null, prompt: nextBrief });
      }

      const { data, error } = await supabase.functions.invoke("generate-lyrics", {
        body: {
          song_id: song.id,
          songName: title.trim(),
          description: nextBrief.trim(),
          styleTags: song.style ? song.style.split("·").map((s) => s.trim()).filter(Boolean) : [],
          foulMouth,
          language,
        },
      });

      if (error) {
        const msg = invokeError(error, "Lyrics generation failed");
        toast.error(msg.toLowerCase().includes("insufficient")
          ? "Not enough coins for a lyrics generation"
          : msg);
        return;
      }
      const next = (data?.lyrics ?? "").toString();
      if (!next) { toast.error("No lyrics returned"); return; }
      setLyrics(next);
      toast.success(`Lyrics ready · -${data?.coin_cost ?? lyricsCost} coins`, {
        description: "Scroll down to review your new lyrics.",
      });
      // Scroll into view + focus the editor so the user immediately sees the result
      requestAnimationFrame(() => {
        const el = lyricsRef.current;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus({ preventScroll: true });
        }
      });
      onSaved?.();

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lyrics generation failed");
    } finally {
      setGenLyrics(false);
    }
  }

  async function generatePreview() {
    if (missing) {
      toast.error("This song is no longer available");
      return;
    }
    if (!isOwner) {
      toast.error("This is a community song — open the studio to create your own");
      return;
    }
    if (!hasLyrics) {
      toast.error("Generate lyrics first");
      return;
    }
    if (balance < previewCost) {
      toast.error(`Need ${previewCost} coins — current balance ${balance}`);
      return;
    }
    setGenPreview(true);
    try {
      if (dirty) {
        await persist({
          title: title.trim() || null,
          prompt: brief,
          lyrics: lyrics.trim() || null,
        });
      }
      const { error } = await supabase.functions.invoke("suno-generate", {
        body: {
          song_id: song.id,
          prompt: brief,
          lyrics,
          title: title.trim() || null,
          style: song.style ?? null,
        },
      });
      if (error) {
        const msg = invokeError(error, "Could not start generation");
        if (/song not found/i.test(msg)) {
          setMissing(true);
          toast.error("This song is no longer available — it may have been deleted. Start a new one from the studio.");
          return;
        }
        toast.error(msg);
        return;
      }
      toast.success(`Generating · -${previewCost} coins`);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start generation");
    } finally {
      setGenPreview(false);
    }
  }

  async function unlockFull() {
    if (!isReady) return;
    if (!song.unlocked && balance < fullUnlockCost) {
      toast.error(`Need ${fullUnlockCost} coins to unlock the HQ version — current balance ${balance}`);
      return;
    }
    setUnlocking(true);
    try {
      if (!song.unlocked) {
        const { data, error } = await supabase.functions.invoke("unlock-full-song", {
          body: { song_id: song.id },
        });
        if (error) {
          toast.error(invokeError(error, "Could not unlock"));
          return;
        }
        if (!data?.already) toast.success(`Unlocked · -${data?.cost ?? fullUnlockCost} coins`);
        onSaved?.();
      }
      const { data: urlData, error: urlErr } = await supabase.functions.invoke("song-url", {
        body: { song_id: song.id, mode: "full" },
      });
      if (urlErr || !urlData?.url) {
        toast.error("Unlocked, but download link failed — try again in a moment");
        return;
      }
      window.open(urlData.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not unlock");
    } finally {
      setUnlocking(false);
    }
  }

  if (missing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5" /> Song removed
          </span>
        </div>
        <Card className="border-dashed border-destructive/40 bg-card/60">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">This song is no longer available</h3>
              <p className="text-sm text-muted-foreground">
                It may have been deleted. Refresh your library to load the latest list,
                or head back to the studio to start a new one.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={() => {
                  setMissing(false);
                  onRefresh?.();
                  onSaved?.();
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Refresh Library
              </Button>
              <Button asChild variant="outline">
                <Link to="/library">Back to library</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isPending && (
        <div className="sticky top-2 z-30">
          <GeneratingProgress
            sampleSeconds={settings?.sample_seconds ?? 30}
            startedAt={song.generation_started_at ?? song.updated_at ?? song.created_at}
            taskId={song.suno_task_id}
            hasLivePreview={!!song.stream_audio_url}
            songId={song.id}
            onCancelled={onSaved}
          />
        </div>
      )}
      <StageStepper current={stage} sampleSeconds={settings?.sample_seconds ?? 30} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Stage 1 — Brief & lyrics */}
          <Card className={cn(stage > 1 && !dirty && "border-primary/30")}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-4 w-4 text-primary" />
                    1 · Lyrics
                  </CardTitle>
                  <CardDescription>
                    Write the brief, hit generate.
                  </CardDescription>

                </div>
                <CostBadge cost={lyricsCost} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
                <div className="space-y-1.5">
                  <Label htmlFor="song-title">Title (optional)</Label>
                  <Input
                    id="song-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Untitled"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="song-language" className="flex items-center gap-2">
                    Language
                    {!isVip && (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">VIP</span>
                    )}
                  </Label>
                  <Select value={language} onValueChange={setLanguage} disabled={!isVip}>
                    <SelectTrigger id="song-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isVip && (
                    <p className="text-[11px] text-muted-foreground">
                      <Link to="/buy-coins" search={{ flow: "vip" } as never} className="text-primary underline">Get VIP</Link> to write songs in any language (Filipino, Spanish, Hindi, Patois…).
                    </p>
                  )}
                </div>
              </div>
              {hasLyrics && languageChanged && (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground/80">
                  Language changed to <b>{language}</b>. Tap <b>Regenerate lyrics</b> to rewrite in {language},
                  or keep your existing lyrics and just <b>Regenerate sample</b> in Stage 2.
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="song-brief">Brief</Label>
                <Textarea
                  id="song-brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={5}
                  placeholder="Who is the song about, the mood, references, memories…"
                />
              </div>


              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="song-lyrics">Lyrics</Label>
                  {hasLyrics && !genLyrics && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500">
                      <Check className="h-3 w-3" /> Lyrics ready
                    </span>
                  )}
                  {genLyrics && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" /> Writing lyrics…
                    </span>
                  )}
                </div>
                {genLyrics ? (
                  <LyricsSkeleton songId={song.id} />
                ) : (

                  <Textarea
                    ref={lyricsRef}
                    id="song-lyrics"
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    rows={12}
                    placeholder={"Tap Generate lyrics below — or paste your own.\n\n[Verse 1]\n…\n[Chorus]\n…"}
                    className="font-mono text-sm"
                  />

                )}
              </div>


              <div className="flex flex-wrap items-center justify-end gap-3">
                {dirty && <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>}
                <label
                  htmlFor="foul-mouth-toggle"
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium"
                  title="Allow explicit language in generated lyrics"
                >
                  <span aria-hidden>🤬</span>
                  <span>Foul mouth</span>
                  <Switch
                    id="foul-mouth-toggle"
                    checked={foulMouth}
                    onCheckedChange={(v) => setFoulMouth.mutate(v)}
                    disabled={setFoulMouth.isPending}
                  />
                </label>
                <Button variant="ghost" onClick={handleSave} disabled={!dirty || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save draft"}
                </Button>

                <Button onClick={generateLyrics} disabled={genLyrics || missing} className="gap-2">
                  {genLyrics ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {hasLyrics ? "Regenerate lyrics" : "Generate lyrics"}
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-background/30 px-1.5 py-0.5 text-[10px] font-semibold">
                    <Coins className="h-3 w-3" /> {lyricsCost}
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stage 2 — Sample */}
          <Card className={cn(stage === 2 && "border-primary/40 shadow-glow", stage < 2 && "opacity-60")}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Play className="h-4 w-4 text-primary" />
                    2 · Preview
                  </CardTitle>
                  <CardDescription>
                    Free {settings?.sample_seconds ?? 30}s sample.
                  </CardDescription>

                </div>
                <CostBadge cost={previewCost} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasLyrics && (
                <p className="text-sm text-muted-foreground">
                  Generate lyrics in stage 1 first.
                </p>
              )}
              {isPending && (
                <>
                  <GeneratingProgress
                    sampleSeconds={settings?.sample_seconds ?? 30}
                    startedAt={song.generation_started_at ?? song.updated_at ?? song.created_at}
                    taskId={song.suno_task_id}
                    hasLivePreview={!!song.stream_audio_url}
                    songId={song.id}
                    onCancelled={onSaved}
                  />
                  {song.stream_audio_url && (
                    <LiveStreamPreview streamUrl={song.stream_audio_url} limitSeconds={35} />
                  )}
                </>
              )}
              {isFailed && (
                <div
                  role="alert"
                  className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Generation failed</p>
                      <p className="mt-0.5 text-xs opacity-90">
                        {song.error_message || "Something went wrong on Suno's side."}
                        {" "}Your coins were refunded automatically.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={generatePreview}
                      disabled={!hasLyrics || genPreview || balance < previewCost || missing}
                      className="gap-1.5"
                    >
                      {genPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Try again
                      <span className="ml-0.5 inline-flex items-center gap-1 rounded-full bg-background/30 px-1.5 py-0.5 text-[10px] font-semibold">
                        <Coins className="h-3 w-3" /> {previewCost}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => lyricsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      className="gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5" /> Tweak lyrics
                    </Button>
                    {balance < previewCost && (
                      <Button asChild size="sm" variant="secondary" className="gap-1.5">
                        <Link to="/buy-coins">
                          <Coins className="h-3.5 w-3.5" /> Top up coins
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {isReady && <InlineSamplePlayer songId={song.id} />}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  onClick={generatePreview}
                  disabled={!hasLyrics || genPreview || isPending || balance < previewCost || missing}
                  aria-busy={genPreview || isPending}
                  className="gap-2"
                >
                  {genPreview || isPending ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    isReady ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {genPreview ? "Starting…" : isPending ? `Generating… ${elapsed}s` : isReady ? "Regenerate sample" : "Generate preview"}
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-background/30 px-1.5 py-0.5 text-[10px] font-semibold">
                    <Coins className="h-3 w-3" /> {previewCost}
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stage 3 — Final song */}
          <Card className={cn(stage === 3 && "border-primary/40 shadow-glow", stage < 3 && "opacity-60")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Music2 className="h-4 w-4 text-primary" />
                3 · Full HQ
              </CardTitle>
              <CardDescription>
                {fullUnlockCost} coins · unlock & download.
              </CardDescription>

            </CardHeader>
            <CardContent className="space-y-3">
              {!isReady ? (
                <p className="text-sm text-muted-foreground">
                  Once the preview is ready, the full track unlocks here.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {song.unlocked
                      ? "Full HQ unlocked. Download as many times as you like."
                      : "Sample plays in the player above. Unlock once to download the full HQ track."}
                  </p>

                  {!song.unlocked && balance < fullUnlockCost && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                      <Coins className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div className="flex-1">
                        <p className="font-semibold text-amber-100">
                          You need {fullUnlockCost - balance} more coin{fullUnlockCost - balance === 1 ? "" : "s"} to unlock
                        </p>
                        <p className="text-xs text-amber-200/80">
                          Balance: {balance} · Cost: {fullUnlockCost}
                        </p>
                      </div>
                      <Button asChild size="sm" className="shrink-0">
                        <Link to="/buy-coins">Top up</Link>
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={generatePreview}
                      disabled={genPreview || isPending || unlocking || missing}
                    >
                      {genPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Regenerate sample
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-background/30 px-1.5 py-0.5 text-[10px] font-semibold">
                        <Coins className="h-3 w-3" /> {previewCost}
                      </span>
                    </Button>
                    <Button
                      onClick={unlockFull}
                      disabled={unlocking || (!song.unlocked && balance < fullUnlockCost)}
                      className="gap-2"
                      aria-live="polite"
                    >
                      {unlocking ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {song.unlocked ? "Preparing download…" : "Processing payment…"}
                        </>
                      ) : (
                        <>
                          <Music2 className="h-4 w-4" />
                          {song.unlocked
                            ? "Download full HQ"
                            : `Unlock & download · ${fullUnlockCost} coins`}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <VariationsCard
            variations={variations}
            variationCost={variationCost}
            basket={basket}
            busyVariation={busyVariation}
            checkingOut={checkingOut}
            balance={balance}
            onToggleBasket={toggleBasket}
            onRevealOne={revealOne}
            onClearBasket={clearBasket}
            onCheckoutBasket={checkoutBasket}
          />
        </div>

        {/* Side rail */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Coins className="h-4 w-4 text-coin" /> Your coins
              </CardTitle>
              <CardDescription>Lyrics {lyricsCost} · Preview {previewCost} · Full {fullUnlockCost}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold tabular-nums">{balance.toLocaleString()}</div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/buy-coins">Top up</Link>
              </Button>
            </CardContent>
          </Card>

          {song.style && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wand2 className="h-3.5 w-3.5" /> Style
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{song.style}</p>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

/**
 * Lyrics skeleton — animated bars that mimic verse/chorus blocks so the
 * textarea area doesn't collapse while the model is writing.
 */
function LyricsSkeleton({ songId }: { songId?: string }) {
  const blocks = [
    { label: "[Verse 1]", lines: 6 },
    { label: "[Chorus]", lines: 4 },
    { label: "[Verse 2]", lines: 6 },
    { label: "[Bridge]", lines: 3 },
  ];
  const [progress, setProgress] = useState(4);
  const [stageLabel, setStageLabel] = useState("Reading your brief…");
  const startedAt = useRef<number>(Date.now());

  // Local easing tween so the bar moves smoothly between real backend events.
  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 95 ? p : p + Math.max(0.2, (95 - p) * 0.015)));
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Realtime: snap to actual backend progress on every songs row update.
  useEffect(() => {
    if (!songId) return;
    const channel = supabase
      .channel(`lyrics-progress:${songId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "songs", filter: `id=eq.${songId}` },
        (payload) => {
          const row = payload.new as { lyrics_progress?: number | null; lyrics_stage?: string | null };
          if (typeof row.lyrics_progress === "number") setProgress((p) => Math.max(p, row.lyrics_progress!));
          if (typeof row.lyrics_stage === "string" && row.lyrics_stage) setStageLabel(row.lyrics_stage);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [songId]);

  // ETA = linear extrapolation from elapsed wall-clock against real progress.
  const elapsedS = (Date.now() - startedAt.current) / 1000;
  const etaSeconds = progress > 5 && progress < 99
    ? Math.max(1, Math.round((elapsedS / progress) * (100 - progress)))
    : null;
  const etaLabel = etaSeconds == null
    ? "Almost there…"
    : etaSeconds >= 60
      ? `~${Math.floor(etaSeconds / 60)}m ${String(etaSeconds % 60).padStart(2, "0")}s left`
      : `~${etaSeconds}s left`;

  return (
    <div
      role="status"
      aria-label="Generating lyrics"
      aria-live="polite"
      className="space-y-4 rounded-md border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-4 font-mono text-sm"
    >
      <div className="flex items-center gap-3 border-b border-primary/20 pb-3">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
          <img
            src={ogBotAsset.url}
            alt=""
            className="relative h-12 w-12 rounded-full ring-2 ring-primary/60 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.9)] animate-bounce"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-primary">OG Bot is cooking…</span>
            <span className="flex items-center gap-2 font-mono text-xs font-semibold tabular-nums text-primary">
              <span>{Math.round(progress)}%</span>
              <span className="rounded-full border border-primary/30 bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {etaLabel}
              </span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {stageLabel}
            <span className="inline-flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
            </span>
          </span>
        </div>
      </div>



      {blocks.map((b, bi) => (
        <div key={bi} className="space-y-1.5">
          <div className="text-[11px] font-semibold text-primary/80">{b.label}</div>
          {Array.from({ length: b.lines }).map((_, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded bg-muted/70"
              style={{
                width: `${55 + ((i * 13 + bi * 7) % 40)}%`,
                animationDelay: `${(bi * b.lines + i) * 80}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}




function CostBadge({ cost }: { cost: number }) {
  return <CoinPill>{cost} per send</CoinPill>;
}

type GenerationStep = {
  label: string;
  detail: string;
  state: "done" | "active" | "waiting";
};

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes <= 0) return `${rest}s`;
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

function getGenerationStatus(elapsed: number, hasTaskId: boolean, hasLivePreview: boolean): {
  progress: number;
  etaSeconds: number;
  headline: string;
  detail: string;
  steps: GenerationStep[];
} {
  const targetSeconds = hasLivePreview ? 85 : hasTaskId ? 100 : 30;
  const progress = !hasTaskId
    ? Math.min(18, 8 + Math.floor(elapsed * 0.4))
    : Math.min(96, Math.max(22, Math.round((elapsed / targetSeconds) * 88)));
  const etaSeconds = !hasTaskId
    ? Math.max(0, 35 - elapsed)
    : Math.max(0, targetSeconds - elapsed);

  if (!hasTaskId) {
    return {
      progress,
      etaSeconds,
      headline: "Starting the music job with the generator…",
      detail: elapsed > 45 ? "Still waiting for the generator to accept the job — I won't fake 99%." : "Getting a real task ID before the mix begins.",
      steps: [
        { label: "Queued", detail: "Saving your prompt", state: "done" },
        { label: "Accepted", detail: "Waiting for task ID", state: "active" },
        { label: "Audio", detail: "Starts after acceptance", state: "waiting" },
      ],
    };
  }

  if (hasLivePreview) {
    return {
      progress: Math.max(progress, 68),
      etaSeconds,
      headline: "Live preview is ready — finishing the downloadable sample…",
      detail: "You can listen now while the final sample file is being packaged.",
      steps: [
        { label: "Queued", detail: "Task accepted", state: "done" },
        { label: "Preview", detail: "Streaming now", state: "done" },
        { label: "Sample", detail: "Packaging audio", state: "active" },
      ],
    };
  }

  return {
    progress,
    etaSeconds,
    headline: elapsed < 35 ? "Composing melody and beat…" : elapsed < 75 ? "Rendering vocals and mix…" : "Waiting for the first audio callback…",
    detail: elapsed > 130 ? "This is taking longer than usual, but the job is still being watched." : "ETA is based on the real job start time, not a fake loading loop.",
    steps: [
      { label: "Queued", detail: "Task accepted", state: "done" },
      { label: "Audio", detail: elapsed < 75 ? "Generating track" : "Awaiting callback", state: "active" },
      { label: "Sample", detail: "Ready after callback", state: "waiting" },
    ],
  };
}

/**
 * Professional "generating" progress block — elapsed timer, animated waveform
 * skeleton, and rotating status copy so the wait feels intentional rather than
 * dead. Suno typically takes 30–90s; we model that with a soft progress curve
 * that asymptotes near the expected window.
 */
function GeneratingProgress({
  sampleSeconds,
  startedAt,
  taskId,
  hasLivePreview = false,
  songId,
  onCancelled,
}: {
  sampleSeconds: number;
  startedAt?: string | null;
  taskId?: string | null;
  hasLivePreview?: boolean;
  songId?: string;
  onCancelled?: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  async function handleCancel() {
    if (!songId || cancelling) return;
    setCancelling(true);
    try {
      const { error } = await supabase.functions.invoke("suno-cancel", {
        body: { song_id: songId },
      });
      if (error) {
        toast.error(invokeError(error, "Could not cancel"));
        return;
      }
      toast.success("Generation cancelled — coins refunded");
      onCancelled?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setCancelling(false);
    }
  }
  // Anchor elapsed to the DB-side start time (song.updated_at when status flipped to
  // pending) so a hard refresh continues the timer mid-flight instead of restarting at 0.
  const startMs = useMemo(() => {
    if (startedAt) {
      const t = Date.parse(startedAt);
      if (!Number.isNaN(t)) return t;
    }
    return Date.now();
  }, [startedAt]);

  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
  useEffect(() => {
    setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    const id = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000))), 250);
    return () => clearInterval(id);
  }, [startMs]);


  const status = getGenerationStatus(elapsed, !!taskId, hasLivePreview);
  const pct = status.progress;
  const etaLabel = status.etaSeconds > 0 ? formatDuration(status.etaSeconds) : "any moment";

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div
      role="status"
      aria-live="polite"
      className="generating-aura relative space-y-4 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.5)]"
    >
      {/* Ambient red/blue glow blobs behind content */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 -z-10 opacity-80"
        style={{
          background:
            "radial-gradient(40% 50% at 15% 30%, rgba(239,68,68,0.35), transparent 70%), radial-gradient(45% 55% at 85% 70%, rgba(59,130,246,0.45), transparent 70%)",
          filter: "blur(24px)",
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative grid h-12 w-12 shrink-0 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
            <img
              src={ogBotAsset.url}
              alt=""
              className="relative h-12 w-12 rounded-full ring-2 ring-primary/60 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.9)] animate-bounce"
            />
          </span>

          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight text-foreground">
              Cooking your {sampleSeconds}s preview
            </p>
            <p className="truncate text-xs text-muted-foreground">{status.headline}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-full border border-primary/40 bg-background/70 px-3 py-1.5 text-right text-xs font-bold text-foreground shadow-[0_0_18px_-4px_hsl(var(--primary)/0.7)]">
            <span className="block tabular-nums">ETA {etaLabel}</span>
            <span className="block text-[10px] font-medium text-muted-foreground tabular-nums">{mm}:{ss} elapsed</span>
          </div>
          {songId && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="h-9 rounded-full px-3"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Stop"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        {status.steps.map((step) => (
          <div
            key={step.label}
            className={cn(
              "rounded-lg border px-3 py-2",
              step.state === "done" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
              step.state === "active" && "border-primary/40 bg-primary/10 text-foreground shadow-[0_0_16px_-8px_hsl(var(--primary)/0.8)]",
              step.state === "waiting" && "border-border bg-background/30",
            )}
          >
            <div className="flex items-center gap-2 font-semibold">
              {step.state === "done" ? <Check className="h-3.5 w-3.5" /> : step.state === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5 rounded-full border border-current opacity-50" />}
              {step.label}
            </div>
            <p className="mt-1 text-[11px] opacity-80">{step.detail}</p>
          </div>
        ))}
      </div>

      {/* Animated waveform skeleton */}
      <div className="flex h-14 items-end gap-1" aria-hidden="true">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm bg-gradient-to-t from-primary/50 to-primary shadow-[0_0_8px_hsl(var(--primary)/0.55)]"
            style={{
              height: `${30 + Math.abs(Math.sin((i + elapsed) * 0.6)) * 70}%`,
              opacity: 0.45 + (i % 4) * 0.15,
              transition: "height 320ms ease-in-out",
            }}
          />
        ))}
      </div>

      {/* Progress bar — thicker, glowing, with moving shimmer */}
      <div className="space-y-1.5">
        <div className="relative h-3 overflow-hidden rounded-full bg-muted/60 ring-1 ring-primary/20">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ef4444] via-primary to-[#3b82f6] shadow-[0_0_16px_hsl(var(--primary)/0.9),0_0_4px_hsl(var(--primary))] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
          {/* Shimmer sheen */}
          <span
            aria-hidden="true"
            className="generating-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>{status.detail}</span>
          <span className="tabular-nums text-foreground/90">{pct}%</span>
        </div>
      </div>

    </div>
  );
}


/**
 * Inline mini-player shown directly under the "Generate preview" button so
 * the user can hear the freshly generated sample without scrolling up.
 * Auto-loads the signed preview URL when the song becomes ready.
 */
function InlineSamplePlayer({ songId }: { songId: string }) {
  const { data: settings } = useSettings();
  const sampleSeconds = settings?.sample_seconds ?? 30;
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setUrl(null);
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("song-url", {
          body: { song_id: songId, mode: "preview" },
        });
        if (cancelled) return;
        if (error || !data?.url) {
          setError(invokeError(error, "Could not load preview"));
        } else {
          setUrl(data.url as string);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [songId]);

  // Enforce the sample-seconds cap so the inline player matches the top one.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (el.currentTime >= sampleSeconds) {
        el.pause();
        el.currentTime = sampleSeconds;
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [sampleSeconds, url]);

  return (
    <div className="space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
        <Check className="h-4 w-4" /> Preview ready · {sampleSeconds}s sample
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading sample…
        </div>
      )}
      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}
      {url && (
        <audio
          ref={audioRef}
          src={url}
          controls
          preload="auto"
          className="w-full rounded-lg bg-black/30"
          aria-label="Sample preview"
        />
      )}
    </div>
  );
}

/**
 * Suno-style live stream preview. Plays the in-progress generation directly
 * from Suno's stream URL while the full sample keeps cooking in the background.
 * Hard-cuts at `limitSeconds` (default 35s) and shows a "keep cooking" blocker
 * so users get instant feedback without being able to scrub past the preview.
 */
function LiveStreamPreview({
  streamUrl,
  limitSeconds = 35,
}: {
  streamUrl: string;
  limitSeconds?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [played, setPlayed] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setPlayed(el.currentTime);
      if (el.currentTime >= limitSeconds) {
        el.pause();
        el.currentTime = limitSeconds;
        setBlocked(true);
      }
    };
    const onSeeking = () => {
      if (el.currentTime > limitSeconds) {
        el.currentTime = limitSeconds;
        setBlocked(true);
      }
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeking", onSeeking);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeking", onSeeking);
    };
  }, [limitSeconds, streamUrl]);

  const pct = Math.min(100, (played / limitSeconds) * 100);
  const remaining = Math.max(0, Math.ceil(limitSeconds - played));

  return (
    <div className="space-y-3 rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-3 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.6)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Live preview · listen while it generates
        </div>
        <span className="rounded-full border border-primary/40 bg-background/60 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground">
          {blocked ? "Locked" : `${remaining}s left`}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={streamUrl}
        controls
        autoPlay
        preload="auto"
        className="w-full rounded-lg bg-black/30"
        aria-label="Live streaming preview"
      />

      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#ef4444] via-primary to-[#3b82f6] transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      {blocked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-amber-300" />
          <div>
            <p className="font-semibold">First {limitSeconds}s preview ended</p>
            <p className="text-amber-200/80">
              The full preview is still cooking — it'll unlock automatically as soon as it's ready.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
