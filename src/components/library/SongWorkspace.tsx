import { useEffect, useRef, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettings } from "@/hooks/use-settings";
import { useProfile } from "@/hooks/use-profile";
import { useVariations } from "@/hooks/use-variations";
import { invokeError } from "@/lib/invoke-error";
import { cn } from "@/lib/utils";
import { StageStepper, type Stage } from "./song-workspace/StageStepper";
import { VariationsCard } from "./song-workspace/VariationsCard";
import type { WorkspaceSong } from "./song-workspace/types";

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
                  {hasLyrics && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500">
                      <Check className="h-3 w-3" /> Lyrics ready
                    </span>
                  )}
                </div>
                <Textarea
                  id="song-lyrics"
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  rows={12}
                  placeholder={"Tap Generate lyrics below — or paste your own.\n\n[Verse 1]\n…\n[Chorus]\n…"}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {dirty && <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>}
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
              {isPending && <GeneratingProgress sampleSeconds={settings?.sample_seconds ?? 30} />}
              {isFailed && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4" aria-hidden="true" /> {song.error_message || "Generation failed."}
                </div>
              )}
              {isReady && (
                <div className="flex items-center gap-2 text-sm text-emerald-500">
                  <Check className="h-4 w-4" /> Preview ready — scroll up to play.
                </div>
              )}
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
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={generatePreview}
                      disabled={genPreview || isPending}
                    >
                      {genPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Regenerate sample
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-background/30 px-1.5 py-0.5 text-[10px] font-semibold">
                        <Coins className="h-3 w-3" /> {previewCost}
                      </span>
                    </Button>
                    <Button onClick={unlockFull} disabled={unlocking}>
                      {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music2 className="h-4 w-4" />}
                      {song.unlocked ? "Download full HQ" : `Unlock & download · ${fullUnlockCost}`}
                    </Button>
                    {balance < fullUnlockCost && !song.unlocked && (
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/buy-coins"><Coins className="h-4 w-4" /> Top up</Link>
                      </Button>
                    )}
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

function CostBadge({ cost }: { cost: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-coin/30 bg-coin/10 px-2.5 py-1 text-xs font-semibold text-coin">
      <Coins className="h-3.5 w-3.5" /> {cost} per send
    </span>
  );
}
