import { memo, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CloudDownload,
  Download,
  Loader2,
  MoreVertical,
  Music2,
  Pause,
  Pencil,
  Play,
  Share2,
  Trash2,
  Wand2,
  LockKeyhole,
  Radio,
} from "lucide-react";

import { toast } from "sonner";
import { useSongAudio } from "@/hooks/use-song-audio";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile } from "@/lib/download-file";
import { shareTrack } from "@/lib/share-track";
import { UnlockConfirmDialog } from "@/components/library/UnlockConfirmDialog";
import { OwnerUnlockDialog } from "@/components/library/OwnerUnlockDialog";
import { useSettings } from "@/hooks/use-settings";
import { CreatorTag } from "@/components/library/CreatorTag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { POOLS } from "@/lib/library-utils";
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

function styleChips(style?: string | null) {
  const value = (style || "").toLowerCase();
  return POOLS.genre.filter((genre) => value.includes(genre.toLowerCase())).slice(0, 2);
}

/**
 * Global (community) library row — cover thumbnail with a polished fallback,
 * title, compact quick actions (play/pause, seek, unlock/download).
 * Community tracks stream in full; downloading costs coins.
 */
function CommunityTrackRowImpl({
  song,
  variant = "community",
  onDelete,
  onRemix,
}: {
  song: Song;
  /** "owned" rows link to the edit/regenerate workspace instead of charging coins. */
  variant?: "owned" | "community";
  onDelete?: (song: Song) => void;
  /** Opens the creation wizard pre-loaded with this track's vibe. */
  onRemix?: (song: Song) => void;
}) {
  const owned = variant === "owned";
  const hasAudio = !!(song.audio_path || song.sample_path);
  const isReady = song.status === "completed" && hasAudio;
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const balance = (profile as { coin_balance?: number } | null)?.coin_balance ?? 0;

  const { audioRef, playing, loadingUrl, progress, togglePlay, handleEnded } = useSongAudio({
    songId: song.id,
    hasAudio,
    ready: isReady,
    // Full playback in the global library — no preview cap, and the signed URL
    // points at the complete master rather than the 60s sample.
    sampleSeconds: Number.MAX_SAFE_INTEGER,
    // Owners hear the full master once unlocked; otherwise the free sample.
    mode: owned && !song.unlocked ? "preview" : "full",
    playlistTitle: song.title || "Untitled track",
  });

  const [duration, setDuration] = useState<number>(song.duration_seconds ?? 0);
  const [coverFailed, setCoverFailed] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [ownerUnlockOpen, setOwnerUnlockOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: settings } = useSettings();
  const fullUnlockCost = settings?.coins_per_full_unlock ?? 5;
  const secondTakeCost =
    Number((settings as { coins_per_remake?: number } | undefined)?.coins_per_remake) || 2;

  /** Owner padlock: unlock the full master, optionally bundling the hidden take. */
  async function ownerUnlock(bundleBoth: boolean) {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("unlock-full-song", {
        body: { song_id: song.id, bundle_both: bundleBoth },
      });
      if (error) {
        throw new Error(
          (error as { context?: { error?: string } })?.context?.error ||
            error.message ||
            "Could not unlock track",
        );
      }
      if (!data?.already) {
        toast.success(
          bundleBoth && data?.second_take
            ? `Both versions unlocked · -${data?.cost ?? fullUnlockCost + secondTakeCost} coins`
            : `Full track unlocked · -${data?.cost ?? fullUnlockCost} coins`,
        );
      }
      setOwnerUnlockOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["profile"] }),
        qc.invalidateQueries({ queryKey: ["recent-songs"] }),
        qc.invalidateQueries({ queryKey: ["songs"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  }

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
        body: { song_id: song.id, mode: "full", purpose: "download", filename: `${title}.mp3` },
      });
      if (error) {
        throw new Error(
          (error as { context?: { error?: string } })?.context?.error ||
            error.message ||
            "Download failed",
        );
      }
      const blob = await downloadFile(data.url as string, `${title}.mp3`);
      setUnlockOpen(false);
      await shareTrack({ title, blob, filename: `${title}.mp3`, songId: song.id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  /** Re-download an already-paid track and hand it to the share sheet. */
  async function shareUnlocked() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("song-url", {
        body: { song_id: song.id, mode: "full", purpose: "download", filename: `${title}.mp3` },
      });
      if (error || !data?.url) throw new Error("Could not prepare the track");
      const { Capacitor } = await import("@capacitor/core");
      // Web: fetch the bytes quietly for the share sheet (no extra file download).
      // Phone app: save the MP3 natively so the share sheet can attach it.
      const blob = Capacitor.isNativePlatform()
        ? await downloadFile(data.url as string, `${title}.mp3`)
        : await fetch(data.url as string).then((r) => {
            if (!r.ok) throw new Error("Could not prepare the track");
            return r.blob();
          });
      await shareTrack({ title, blob, filename: `${title}.mp3`, songId: song.id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  const canShare = isReady && !!song.unlocked;
  const driveLink = (song as unknown as { drive_audio_link?: string | null }).drive_audio_link;
  const styles = styleChips(song.style);

  const actions = (
    <div className="flex shrink-0 items-center gap-1.5">
      {owned && !song.unlocked && isReady && (
        <button
          type="button"
          onClick={() => setOwnerUnlockOpen(true)}
          disabled={busy}
          aria-label={`Unlock the full version of ${title}`}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 text-xs font-black tabular-nums text-amber-300 transition-colors hover:bg-amber-500/25 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LockKeyhole className="h-4 w-4" />
          )}
          <span>{fullUnlockCost}</span>
          <span className="sr-only">OG coins to unlock</span>
        </button>
      )}
      {owned ? (
        <Link
          to="/library/$songId"
          params={{ songId: song.id }}
          aria-label={`Edit ${title}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
        >
          <Pencil className="h-4 w-4" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setUnlockOpen(true)}
          disabled={!isReady || busy}
          aria-label={`Download ${title} for ${COMMUNITY_DOWNLOAD_COST} OG coins or 99p`}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 text-xs font-black tabular-nums text-primary transition-colors",
            isReady && !busy ? "hover:bg-primary/25" : "opacity-40",
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span>{COMMUNITY_DOWNLOAD_COST}</span>
          <span className="sr-only">OG coins or 99p</span>
        </button>
      )}
      {(canShare || (owned && driveLink) || onDelete || onRemix) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`More actions for ${title}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-muted-foreground transition-colors hover:text-foreground"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onRemix && (
              <DropdownMenuItem onSelect={() => onRemix(song)}>
                <Wand2 className="mr-2 h-4 w-4" /> Remix vibe
              </DropdownMenuItem>
            )}
            {canShare && (
              <DropdownMenuItem disabled={busy} onSelect={() => void shareUnlocked()}>
                <Share2 className="mr-2 h-4 w-4" /> Share track
              </DropdownMenuItem>
            )}
            {owned && driveLink && (
              <DropdownMenuItem asChild>
                <a href={driveLink} target="_blank" rel="noreferrer">
                  <CloudDownload className="mr-2 h-4 w-4" /> Open Drive backup
                </a>
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onDelete(song)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <li
      className={cn(
        "group relative px-3 py-2.5 transition-colors hover:bg-primary/[0.06]",
        playing && "bg-primary/[0.08] shadow-[inset_3px_0_0_var(--primary)]",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        {/* Artwork doubles as the play / pause control. */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!isReady}
          aria-label={`${playing ? "Pause" : "Play"} ${title}`}
          className={cn(
            "relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-card transition-transform",
            isReady ? "hover:scale-[1.04] active:scale-95" : "opacity-50",
            playing && "border-primary/60 shadow-[0_0_18px_-6px_var(--primary)]",
          )}
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
            <span className="grid h-full w-full place-items-center font-display text-base font-black uppercase text-white/85">
              {title.trim().charAt(0) || <Music2 className="h-5 w-5 text-white/70" />}
            </span>
          )}
          <span
            className={cn(
              "absolute inset-0 grid place-items-center bg-background/55 text-primary-foreground transition-opacity",
              playing || loadingUrl ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            {loadingUrl ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : playing ? (
              <span className="flex h-4 items-end gap-[3px]" aria-hidden>
                <i className="h-2 w-[3px] animate-[eqbar_0.9s_ease-in-out_infinite] rounded-full bg-primary" />
                <i className="h-4 w-[3px] animate-[eqbar_0.7s_ease-in-out_infinite] rounded-full bg-primary" />
                <i className="h-3 w-[3px] animate-[eqbar_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
              </span>
            ) : (
              <Play className="h-5 w-5 translate-x-[1px] text-primary" />
            )}
          </span>
        </button>

        <div className="min-w-0">
          {owned ? (
            <Link
              to="/library/$songId"
              params={{ songId: song.id }}
              className="line-clamp-1 text-[15px] font-semibold leading-snug hover:text-primary focus:outline-none focus-visible:underline"
            >
              {title}
            </Link>
          ) : (
            <p className="line-clamp-1 text-[15px] font-semibold leading-snug">{title}</p>
          )}

          {/* One quiet metadata line: creator · styles · duration. */}
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <CreatorTag userId={song.user_id} />
            {styles.length > 0 && (
              <span className="truncate">
                {styles.join(", ")}
              </span>
            )}
            {duration > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{fmt(duration)}</span>
              </>
            )}
          </div>

          {(song.is_variation || !(song.unlocked || song.artistUnlocked)) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {song.is_variation && (
                <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold text-amber-300">
                  Second take
                </span>
              )}
              {!(song.unlocked || song.artistUnlocked) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
                  <Radio className="h-2.5 w-2.5" />
                  {owned ? "Preview" : "Stream"}
                </span>
              )}
            </div>
          )}
        </div>
        {actions}
      </div>

      {/* Ultra-thin progress line, only for the track that's playing. */}
      {(playing || progress > 0) && duration > 0 && (
        <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-400 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

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
        songId={song.id}
      />

      {owned && (
        <OwnerUnlockDialog
          open={ownerUnlockOpen}
          onOpenChange={setOwnerUnlockOpen}
          songId={song.id}
          songTitle={song.title}
          balance={balance}
          singleCost={fullUnlockCost}
          secondTakeCost={secondTakeCost}
          busy={busy}
          onConfirm={(bundle) => void ownerUnlock(bundle)}
        />
      )}
    </li>
  );
}

export const CommunityTrackRow = memo(CommunityTrackRowImpl);
export const TrackRow = CommunityTrackRow;
