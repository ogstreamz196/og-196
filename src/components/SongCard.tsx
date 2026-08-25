import { memo } from "react";
import { Play, Pause, Loader2, Music2, Download, AlertCircle, Lock } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { useSongAudio } from "@/hooks/use-song-audio";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Song {
  id: string;
  user_id?: string | null;
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
  updated_at?: string | null;
  generation_started_at?: string | null;
  suno_task_id?: string | null;
  stream_audio_url?: string | null;
}

function SongCardImpl({ song }: { song: Song }) {
  const { data: settings } = useSettings();
  const sampleSeconds = settings?.sample_seconds ?? 60;

  const hasAudio = !!(song.audio_path || song.sample_path);
  const isReady = song.status === "completed" && hasAudio;
  const isFailed = song.status === "failed";
  const isPending = song.status === "pending" || song.status === "processing";

  const {
    audioRef,
    playing,
    loadingUrl,
    progress,
    togglePlay,
    download,
    handleEnded,
  } = useSongAudio({
    songId: song.id,
    hasAudio,
    ready: isReady,
    sampleSeconds,
  });

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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => download(`${song.title || "song"}.mp3`)}
            >
              <Download className="mr-2 h-3.5 w-3.5" /> Download (free)
            </Button>
          )}
        </div>
      </div>

      <audio ref={audioRef} preload="auto" onEnded={handleEnded} className="hidden" />
    </div>
  );
}

export const SongCard = memo(SongCardImpl, (a, b) =>
  a.song.id === b.song.id &&
  a.song.status === b.song.status &&
  a.song.audio_path === b.song.audio_path &&
  a.song.sample_path === b.song.sample_path &&
  a.song.cover_url === b.song.cover_url &&
  a.song.title === b.song.title &&
  a.song.error_message === b.song.error_message,
);
