import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Music2,
  Play,
  Pause,
  Download,
  Lock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import type { Song } from "@/components/SongCard";

export const Route = createFileRoute("/_authenticated/library/$songId")({
  component: SongDetailPage,
});

type FullSong = Song & { unlocked?: boolean | null };

function SongDetailPage() {
  const { songId } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["song", songId],
    queryFn: async (): Promise<FullSong | null> => {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .eq("id", songId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as FullSong | null;
    },
    // While the song is pending/processing, refetch in the background as a
    // safety net even if realtime drops messages.
    refetchInterval: (q) => {
      const s = q.state.data as FullSong | null | undefined;
      if (!s) return 4000;
      return s.status === "pending" || s.status === "processing" ? 4000 : false;
    },
  });

  // Realtime subscription scoped to this single row.
  useEffect(() => {
    const channel = supabase
      .channel(`song-detail:${songId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "songs", filter: `id=eq.${songId}` },
        () => qc.invalidateQueries({ queryKey: ["song", songId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [songId, qc]);

  return (
    <DashboardShell title="Player">
      <div className="mx-auto max-w-3xl space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/library">
            <ArrowLeft className="h-4 w-4" /> Back to library
          </Link>
        </Button>

        {isLoading ? (
          <SkeletonState message="Loading track…" />
        ) : error || !data ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center text-muted-foreground">
            Track not found.
          </div>
        ) : (
          <PlayerCard song={data} onRefresh={refetch} />
        )}
      </div>
    </DashboardShell>
  );
}

function SkeletonState({ message }: { message: string }) {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-card py-16 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function PlayerCard({ song, onRefresh }: { song: FullSong; onRefresh: () => void }) {
  const { data: settings } = useSettings();
  const sampleSeconds = settings?.sample_seconds ?? 30;

  const isReady = song.status === "completed" && !!(song.audio_path || (song as any).sample_path);
  const isFailed = song.status === "failed";
  const isPending = song.status === "pending" || song.status === "processing";
  const unlocked = !!song.unlocked;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-load the preview URL as soon as the song becomes ready,
  // and warm the <audio> element so the first play click is instant.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isReady || previewUrl || loadingPreview) return;
      setLoadingPreview(true);
      try {
        const { data, error } = await supabase.functions.invoke("song-url", {
          body: { song_id: song.id, mode: "preview" },
        });
        if (error) throw error;
        if (cancelled) return;
        setPreviewUrl(data.url as string);
        const el = audioRef.current;
        if (el && el.src !== data.url) {
          el.src = data.url as string;
          el.load();
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Could not load preview");
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isReady, song.id, previewUrl, loadingPreview]);

  // Enforce sample-seconds cap on the preview stream.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setProgress(el.currentTime);
      if (el.currentTime >= sampleSeconds) {
        el.pause();
        el.currentTime = 0;
        setPlaying(false);
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [sampleSeconds]);

  async function togglePlay() {
    if (!previewUrl) return;
    const el = audioRef.current!;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      if (el.src !== previewUrl) el.src = previewUrl;
      await el.play();
      setPlaying(true);
    }
  }

  async function downloadFull() {
    if (!unlocked) {
      toast.error("This track isn't unlocked. Purchase or unlock to download the full version.");
      return;
    }
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("song-url", {
        body: { song_id: song.id, mode: "full" },
      });
      if (error) {
        const msg =
          (error as { context?: { error?: string } })?.context?.error ||
          error.message ||
          "Download failed";
        throw new Error(msg);
      }
      const a = document.createElement("a");
      a.href = data.url as string;
      a.download = `${song.title || "song"}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const progressPct = useMemo(
    () => Math.min(100, (progress / sampleSeconds) * 100),
    [progress, sampleSeconds],
  );

  return (
    <article className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="relative h-48 w-48 shrink-0 self-center overflow-hidden rounded-xl bg-gradient-brand-soft">
          {song.cover_url ? (
            <img src={song.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <Music2 className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {isPending && (
            <div className="absolute inset-0 grid place-items-center bg-black/55">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {song.title || (isPending ? "Generating…" : "Untitled")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{song.prompt}</p>
            {song.style && (
              <span className="mt-3 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                {song.style}
              </span>
            )}
          </div>

          <div className="mt-4">
            {isPending && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Generating your track — this can take up to a minute. Updates appear automatically.
              </div>
            )}
            {isFailed && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {song.error_message || "Generation failed."}
              </div>
            )}
            {isReady && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" /> Ready to play
              </div>
            )}
          </div>

          {isReady && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <Button
                  onClick={togglePlay}
                  disabled={!previewUrl || loadingPreview}
                  size="lg"
                  className="rounded-full"
                >
                  {loadingPreview ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : playing ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                  {playing ? "Pause preview" : "Play preview"}
                </Button>
                <Button
                  onClick={downloadFull}
                  disabled={downloading || !unlocked}
                  variant={unlocked ? "default" : "outline"}
                  size="lg"
                >
                  {downloading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : unlocked ? (
                    <Download className="h-5 w-5" />
                  ) : (
                    <Lock className="h-5 w-5" />
                  )}
                  {unlocked ? "Download HQ" : "Locked"}
                </Button>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Preview limited to {sampleSeconds}s. {unlocked
                    ? "Full track download available."
                    : "Unlock to download the full track."}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="mt-4">
              <Button variant="outline" onClick={onRefresh} size="sm">
                Refresh
              </Button>
            </div>
          )}
        </div>
      </div>

      <audio ref={audioRef} onEnded={() => setPlaying(false)} className="hidden" />
    </article>
  );
}
