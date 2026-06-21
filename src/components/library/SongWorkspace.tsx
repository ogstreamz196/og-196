import { useState } from "react";
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
import { cn } from "@/lib/utils";
import type { Song } from "@/components/SongCard";

type WorkspaceSong = Song & { lyrics?: string | null };

interface Props {
  song: WorkspaceSong;
  onSaved?: () => void;
}

type Stage = 1 | 2 | 3;

/**
 * 3-stage music creation workflow:
 *   1. Lyrics       — user crafts a brief and generates lyrics (charged)
 *   2. Sample       — generate a 30s preview of the full song (charged)
 *   3. Final song   — full track ready to play / download (uses preview unlock)
 * Edits at any stage can be re-sent and re-cost coins, same as every other AI message.
 */
export function SongWorkspace({ song, onSaved }: Props) {
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();
  const lyricsCost = settings?.coins_per_lyrics_generation ?? 1;
  const previewCost = settings?.coins_per_generation ?? 3;
  const balance = profile?.coin_balance ?? 0;

  const [title, setTitle] = useState(song.title ?? "");
  const [brief, setBrief] = useState(song.prompt ?? "");
  const [lyrics, setLyrics] = useState(song.lyrics ?? "");
  const [saving, setSaving] = useState(false);
  const [genLyrics, setGenLyrics] = useState(false);
  const [genPreview, setGenPreview] = useState(false);

  const hasLyrics = !!(lyrics && lyrics.trim().length > 20);
  const isPending = song.status === "pending" || song.status === "processing";
  const isReady = song.status === "completed";
  const isFailed = song.status === "failed";

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
      // Persist latest brief/title first so the server has the up-to-date prompt.
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
        const msg = (error as { context?: { error?: string } })?.context?.error || error.message;
        if (msg?.toLowerCase().includes("insufficient")) {
          toast.error("Not enough coins for a lyrics generation");
        } else {
          toast.error(msg || "Lyrics generation failed");
        }
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
        const msg = (error as { context?: { error?: string } })?.context?.error || error.message;
        toast.error(msg || "Could not start generation");
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

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <StageStepper current={stage} />

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
              {isPending && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Generating preview — refreshes automatically.
                </div>
              )}
              {isFailed && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {song.error_message || "Generation failed."}
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
                Built from your stage-1 lyrics, style and brief. Unlock to download HQ.
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
                    The full track is rendered. Use the player above to preview, or unlock it to download the HQ version.
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild variant="outline">
                      <Link to="/buy-coins">
                        <Coins className="h-4 w-4" /> Top up coins
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
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

function StageStepper({ current }: { current: Stage }) {
  const steps: { id: Stage; label: string; sub: string }[] = [
    { id: 1, label: "Lyrics", sub: "Craft the words" },
    { id: 2, label: "Sample", sub: "30s preview" },
    { id: 3, label: "Full song", sub: "Final track" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3">
      {steps.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-start gap-3">
            <div
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition",
                done && "bg-emerald-500 text-white",
                active && "bg-gradient-brand text-primary-foreground shadow-glow",
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <div className="min-w-0">
              <p className={cn("truncate text-sm font-semibold", !active && !done && "text-muted-foreground")}>
                {s.label}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{s.sub}</p>
            </div>
          </div>
        );
      })}
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
