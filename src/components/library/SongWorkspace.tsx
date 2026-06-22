import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Loader2, FileText, MessageSquareMore, Wand2, ExternalLink,
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

import { useProfile } from "@/hooks/use-profile";
import { useVariations } from "@/hooks/use-variations";
import { invokeError } from "@/lib/invoke-error";
import { cn } from "@/lib/utils";
import { StageStepper, type Stage } from "./song-workspace/StageStepper";
import { VariationsCard } from "./song-workspace/VariationsCard";
import type { WorkspaceSong } from "./song-workspace/types";
import ogBotAsset from "@/assets/ogbot.png.asset.json";

interface Props {
  song: WorkspaceSong;
  onSaved?: () => void;
}

/**
 * 3-stage music creation workflow:
 *   1. Lyrics       — user crafts a brief and generates lyrics (charged)
 *   2. Sample       — generate a short preview of the full song (charged)
 *   3. Final song   — full track ready to play / download (uses preview unlock)
 * Edits at any stage can be re-sent and re-cost coins, same as every other AI message.
 */
export function SongWorkspace({ song, onSaved }: Props) {
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();
  const { foulMouth } = useFoulMouth();
  const setFoulMouth = useSetFoulMouth();

  const lyricsCost = settings?.coins_per_lyrics_generation ?? 1;
  const previewCost = settings?.coins_per_generation ?? 3;
  const fullUnlockCost = settings?.coins_per_full_unlock ?? 5;
  const balance = profile?.coin_balance ?? 0;

  const [title, setTitle] = useState(song.title ?? "");
  const [brief, setBrief] = useState(song.prompt ?? "");
  const [lyrics, setLyrics] = useState(song.lyrics ?? "");
  const [saving, setSaving] = useState(false);
  const [genLyrics, setGenLyrics] = useState(false);
  const [genPreview, setGenPreview] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

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

    const poll = setInterval(() => onSaved?.(), 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, song.status]);

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
      if (dirty) await persist({ title: title.trim() || null, prompt: brief });

      const { data, error } = await supabase.functions.invoke("generate-lyrics", {
        body: {
          song_id: song.id,
          songName: title.trim(),
          description: brief.trim(),
          styleTags: song.style ? song.style.split("·").map((s) => s.trim()).filter(Boolean) : [],
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
      toast.success(`Lyrics ready · -${data?.coin_cost ?? lyricsCost} coins`);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lyrics generation failed");
    } finally {
      setGenLyrics(false);
    }
  }

  async function generatePreview() {
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
        toast.error(invokeError(error, "Could not start generation"));
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
                    Stage 1 · Lyrics
                  </CardTitle>
                  <CardDescription>
                    Describe the song. Edit anytime and resend — each lyrics generation costs {lyricsCost} coin{lyricsCost === 1 ? "" : "s"}.
                  </CardDescription>
                </div>
                <CostBadge cost={lyricsCost} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <LyricsSkeleton />
                ) : (
                  <Textarea
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

                <Button onClick={generateLyrics} disabled={genLyrics} className="gap-2">
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
                    Stage 2 · Preview sample
                  </CardTitle>
                  <CardDescription>
                    Generate a free preview using your lyrics. {settings?.sample_seconds ?? 30}s sample appears in the player above.
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
                    <LiveStreamPreview streamUrl={song.stream_audio_url} limitSeconds={20} />
                  )}
                </>
              )}
              {isFailed && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4" aria-hidden="true" /> {song.error_message || "Generation failed."}
                </div>
              )}
              {isReady && <InlineSamplePlayer songId={song.id} />}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  onClick={generatePreview}
                  disabled={!hasLyrics || genPreview || isPending}
                  className="gap-2"
                >
                  {genPreview || isPending ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    isReady ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isReady ? "Regenerate sample" : isPending ? "Generating…" : "Generate preview"}
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
                Stage 3 · Create the full song
              </CardTitle>
              <CardDescription>
                Preview is a fast compressed sample. Pay {fullUnlockCost} coins once to unlock and download the full HQ version, or regenerate the sample for {previewCost}.
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
                      disabled={genPreview || isPending || unlocking}
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
              <CardDescription>Every generation uses coins — same as any AI message.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold tabular-nums">{balance.toLocaleString()}</div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>· Lyrics generation: <b className="text-foreground">{lyricsCost}</b></p>
                <p>· Preview sample: <b className="text-foreground">{previewCost}</b></p>
                <p>· Full HQ unlock: <b className="text-foreground">{fullUnlockCost}</b></p>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/buy-coins">Top up</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wand2 className="h-4 w-4" /> Style
              </CardTitle>
              <CardDescription>Locked in from stage 1.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {song.style || "No style tags yet. Update the brief and resend stage 1 to refine."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquareMore className="h-4 w-4" /> Need a hand?
              </CardTitle>
              <CardDescription>Brainstorm with OG Messenger.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/messenger">
                  Open OG Messenger <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Lyrics skeleton — animated bars that mimic verse/chorus blocks so the
 * textarea area doesn't collapse while the model is writing.
 */
function LyricsSkeleton() {
  const blocks = [
    { label: "[Verse 1]", lines: 6 },
    { label: "[Chorus]", lines: 4 },
    { label: "[Verse 2]", lines: 6 },
    { label: "[Bridge]", lines: 3 },
  ];
  const STAGES = [
    { at: 0, label: "Reading your brief…" },
    { at: 20, label: "Finding the vibe…" },
    { at: 40, label: "Writing verses…" },
    { at: 65, label: "Dropping the hook…" },
    { at: 85, label: "Polishing bars…" },
    { at: 95, label: "Almost ready…" },
  ];
  const [progress, setProgress] = useState(4);
  useEffect(() => {
    const id = setInterval(() => {
      // ease toward 95 — real completion will unmount this component
      setProgress((p) => (p >= 95 ? 95 : p + Math.max(0.4, (95 - p) * 0.04)));
    }, 250);
    return () => clearInterval(id);
  }, []);
  const stage = STAGES.slice().reverse().find((s) => progress >= s.at) ?? STAGES[0];
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
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary">OG Bot is cooking…</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-primary">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {stage.label}
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
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-coin/30 bg-coin/10 px-2.5 py-1 text-xs font-semibold text-coin">
      <Coins className="h-3.5 w-3.5" /> {cost} per send
    </span>
  );
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
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/20 ring-1 ring-primary/40">
            <span className="absolute inset-0 rounded-full bg-primary/40 blur-lg animate-pulse" />
            <Loader2 className="relative h-5 w-5 animate-spin text-primary" aria-hidden="true" />
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
 * Hard-cuts at `limitSeconds` (default 20s) and shows a "keep cooking" blocker
 * so users get instant feedback without being able to scrub past the preview.
 */
function LiveStreamPreview({
  streamUrl,
  limitSeconds = 20,
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
