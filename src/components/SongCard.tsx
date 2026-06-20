import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2, Music2, Download, AlertCircle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Song {
  id: string;
  title: string | null;
  prompt: string;
  style: string | null;
  status: string;
  audio_path: string | null;
  sample_path?: string | null;
  cover_url: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
}

export function SongCard({ song }: { song: Song }) {
  const { data: settings } = useSettings();
  const sampleSeconds = settings?.sample_seconds ?? 30;

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isReadyForPreview =
    song.status === "completed" && !!(song.audio_path || song.sample_path);

  async function ensureUrl() {
    if (signedUrl || (!song.audio_path && !song.sample_path)) return signedUrl;
    setLoadingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke("song-url", {
        body: { song_id: song.id, mode: "preview" },
      });
      if (error) throw error;
      setSignedUrl(data.url);
      // Warm the audio element so playback starts instantly on click.
      const el = audioRef.current;
      if (el && el.src !== data.url) {
        el.src = data.url as string;
        el.load();
      }
      return data.url as string;
    } finally {
      setLoadingUrl(false);
    }
  }

  // Pre-fetch the signed URL as soon as the song is ready so the first
  // play click is instant instead of waiting on a round-trip + buffering.
  useEffect(() => {
    if (!isReadyForPreview || signedUrl || loadingUrl) return;
    ensureUrl().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadyForPreview, song.id]);

  async function togglePlay() {
    const url = await ensureUrl();
    if (!url) return;
    const el = audioRef.current!;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      if (el.src !== url) el.src = url;
      await el.play();
      setPlaying(true);
    }
  }

  async function download() {
    const url = await ensureUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${song.title || "song"}.mp3`;
    a.click();
  }

  // Cap preview playback at sample_seconds
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

  const isReady = song.status === "completed" && !!(song.audio_path || song.sample_path);
  const isFailed = song.status === "failed";
  const isPending = song.status === "pending" || song.status === "processing";

  return (
    <div className="group flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-glow">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-brand-soft">
        {song.cover_url ? (
          <img
            src={song.cover_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Music2 className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {isReady && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={playing ? "Pause" : "Play"}
          >
            {loadingUrl ? (
              <Loader2 className="h-7 w-7 animate-spin text-white" />
            ) : playing ? (
              <Pause className="h-7 w-7 text-white" />
            ) : (
              <Play className="h-7 w-7 text-white" />
            )}
          </button>
        )}
        {isPending && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <h3 className="truncate font-semibold">
            {song.title || (isPending ? "Generating..." : "Untitled")}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{song.prompt}</p>
          {song.style && (
            <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {song.style}
            </span>
          )}
        </div>

        {isReady && (
          <div className="mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Preview limited to {sampleSeconds}s • Download for full track</span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (progress / sampleSeconds) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <span
            className={cn(
              "text-xs font-medium",
              isReady && "text-primary",
              isPending && "text-muted-foreground",
              isFailed && "text-destructive",
            )}
          >
            {isReady && "Ready"}
            {isPending && "Generating song..."}
            {isFailed && (
              <span className="inline-flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {song.error_message || "Failed"}
              </span>
            )}
          </span>
          {isReady && (
            <Button size="sm" variant="ghost" onClick={download}>
              <Download className="mr-2 h-3.5 w-3.5" /> Download (free)
            </Button>
          )}
        </div>
      </div>

      <audio ref={audioRef} preload="auto" onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  );
}
