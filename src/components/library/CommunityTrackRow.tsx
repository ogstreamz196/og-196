import { memo, useEffect, useState } from "react";
import { Loader2, Music2, Pause, Play } from "lucide-react";
import { useSongAudio } from "@/hooks/use-song-audio";
import { cn } from "@/lib/utils";
import type { Song } from "@/components/SongCard";

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Global (community) library row — deliberately minimal: cover thumbnail,
 * title, play/pause and a seekable progress bar showing track length.
 * Community tracks stream in full; downloading is what costs coins.
 */
function CommunityTrackRowImpl({ song }: { song: Song }) {
  const hasAudio = !!(song.audio_path || song.sample_path);
  const isReady = song.status === "completed" && hasAudio;

  const { audioRef, playing, loadingUrl, progress, togglePlay, handleEnded } = useSongAudio({
    songId: song.id,
    hasAudio,
    ready: isReady,
    // Full playback in the global library — no preview cap.
    sampleSeconds: Number.MAX_SAFE_INTEGER,
  });

  const [duration, setDuration] = useState<number>(song.duration_seconds ?? 0);
  useEffect(() => {
    if (song.duration_seconds) setDuration(song.duration_seconds);
  }, [song.duration_seconds]);

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  return (
    <li className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-card">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-brand-soft">
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
            <Music2 className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={togglePlay}
        disabled={!isReady}
        aria-label={`${playing ? "Pause" : "Play"} ${song.title || "Untitled"}`}
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/15 text-primary transition-colors",
          isReady ? "hover:bg-primary/25" : "opacity-40",
        )}
      >
        {loadingUrl ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px]" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">
          {song.title || "Untitled track"}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.round(duration))}
            step={1}
            value={Math.min(Math.round(progress), Math.max(1, Math.round(duration)))}
            onChange={(e) => {
              const el = audioRef.current;
              if (el) el.currentTime = Number(e.target.value);
            }}
            disabled={!isReady || duration <= 0}
            aria-label={`Seek ${song.title || "track"}`}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:cursor-default"
            style={{
              background: `linear-gradient(to right, var(--primary) ${pct}%, var(--muted) ${pct}%)`,
            }}
          />
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {playing || progress > 0 ? `${fmt(progress)} / ` : ""}
            {fmt(duration)}
          </span>
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onEnded={handleEnded}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        className="hidden"
      />
    </li>
  );
}

export const CommunityTrackRow = memo(CommunityTrackRowImpl);
