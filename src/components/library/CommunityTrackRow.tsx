import { memo, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Music2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { useSongAudio } from "@/hooks/use-song-audio";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { UnlockConfirmDialog } from "@/components/library/UnlockConfirmDialog";
import { cn } from "@/lib/utils";
import type { Song } from "@/components/SongCard";

export const COMMUNITY_DOWNLOAD_COST = 3;
export const COMMUNITY_DOWNLOAD_ROYALTY = 1;

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Deterministic hue from the song id so placeholders feel intentional, not random. */
function hueFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/**
 * Global (community) library row — cover thumbnail with a polished fallback,
 * title, compact quick actions (play/pause, seek, unlock/download).
 * Community tracks stream in full; downloading costs coins.
 */
function CommunityTrackRowImpl({ song }: { song: Song }) {
  const hasAudio = !!(song.audio_path || song.sample_path);
  const isReady = song.status === "completed" && hasAudio;
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const balance = (profile as { coin_balance?: number } | null)?.coin_balance ?? 0;

  const { audioRef, playing, loadingUrl, progress, togglePlay, handleEnded } = useSongAudio({
    songId: song.id,
    hasAudio,
    ready: isReady,
    // Full playback in the global library — no preview cap.
    sampleSeconds: Number.MAX_SAFE_INTEGER,
  });

  const [duration, setDuration] = useState<number>(song.duration_seconds ?? 0);
  const [coverFailed, setCoverFailed] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (song.duration_seconds) setDuration(song.duration_seconds);
  }, [song.duration_seconds]);

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const title = song.title || "Untitled track";
  const showCover = !!song.cover_url && !coverFailed;
  const hue = hueFor(song.id);

  async function confirmDownload() {
    setBusy(true);
    try {
      const { data: unlockData, error: unlockErr } = await supabase.functions.invoke(
        "unlock-full-song",
        { body: { song_id: song.id } },
      );
      if (unlockErr) {
        throw new Error(
          (unlockErr as { context?: { error?: string } })?.context?.error ||
            unlockErr.message ||
            "Could not unlock track",
        );
      }
      if (!unlockData?.already) {
        toast.success(
          `Charged ${unlockData?.cost ?? COMMUNITY_DOWNLOAD_COST} OG coins — ${
            unlockData?.royalty ?? COMMUNITY_DOWNLOAD_ROYALTY
          } sent to the creator as a royalty.`,
        );
      }
      await qc.invalidateQueries({ queryKey: ["profile"] });

      const { data, error } = await supabase.functions.invoke("song-url", {
        body: { song_id: song.id, mode: "full", purpose: "download" },
      });
      if (error) {
        throw new Error(
          (error as { context?: { error?: string } })?.context?.error ||
            error.message ||
            "Download failed",
        );
      }
      const a = document.createElement("a");
      a.href = data.url as string;
      a.download = `${title}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setUnlockOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="group flex items-center gap-2.5 px-2.5 py-2.5 transition-colors hover:bg-primary/[0.06] sm:gap-3 sm:px-3">
      {/* Fixed-size cover box reserves space up front — no layout shift on load */}
      <div
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-card"
        style={{
          backgroundImage: showCover
            ? undefined
            : `linear-gradient(140deg, oklch(0.32 0.13 ${hue}), oklch(0.18 0.06 ${(hue + 40) % 360}))`,
        }}
      >
        {showCover ? (
          <img
            src={song.cover_url!}
            alt=""
            loading="lazy"
            decoding="async"
            width={48}
            height={48}
            onError={() => setCoverFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <span className="font-display text-base font-black uppercase text-white/85">
              {title.trim().charAt(0) || <Music2 className="h-5 w-5 text-white/70" />}
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={togglePlay}
        disabled={!isReady}
        aria-label={`${playing ? "Pause" : "Play"} ${title}`}
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
        <p className="truncate text-sm font-semibold leading-tight">{title}</p>
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
            aria-label={`Seek ${title}`}
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

      <button
        type="button"
        onClick={() => setUnlockOpen(true)}
        disabled={!isReady || busy}
        aria-label={`Download ${title} for ${COMMUNITY_DOWNLOAD_COST} OG coins`}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-black tabular-nums text-primary transition-colors",
          isReady && !busy ? "hover:bg-primary/20" : "opacity-40",
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span>{COMMUNITY_DOWNLOAD_COST}</span>
        <span className="sr-only">OG coins</span>
      </button>

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

      <UnlockConfirmDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onConfirm={confirmDownload}
        busy={busy}
        cost={COMMUNITY_DOWNLOAD_COST}
        royalty={COMMUNITY_DOWNLOAD_ROYALTY}
        balance={balance}
        songTitle={song.title}
      />
    </li>
  );
}

export const CommunityTrackRow = memo(CommunityTrackRowImpl);
