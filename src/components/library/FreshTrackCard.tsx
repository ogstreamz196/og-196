import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, Loader2, Lock, Pause, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UnlockConfirmDialog } from "@/components/library/UnlockConfirmDialog";
import type { Song } from "@/components/SongCard";

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The last step of the creation flow: the freshly finished sample plays
 * automatically, and unlocking the full track happens right here — no detour
 * to another page.
 */
export function FreshTrackCard({
  song,
  sampleSeconds,
  unlockCost,
  balance,
  onDismiss,
  autoUnlockPrompt,
}: {
  song: Song;
  sampleSeconds: number;
  unlockCost: number;
  balance: number;
  onDismiss: () => void;
  /** Open the unlock sheet as soon as the card appears (from the toast CTA). */
  autoUnlockPrompt?: boolean;
}) {
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unlockOpen, setUnlockOpen] = useState(!!autoUnlockPrompt);
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(!!song.unlocked);
  const title = song.title || "Your track";
  const cap = Math.max(5, sampleSeconds);

  // Fetch the preview URL and start playing straight away.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("song-url", {
          body: { song_id: song.id, mode: "preview" },
        });
        if (error) throw error;
        if (cancelled) return;
        const el = audioRef.current;
        if (!el) return;
        el.src = data.url as string;
        el.load();
        try {
          await el.play();
          setPlaying(true);
        } catch {
          /* autoplay blocked — the user can tap play */
        }
      } catch {
        /* silent: the play button will retry */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, [song.id]);

  // Keep the preview capped to the configured sample length.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setProgress(el.currentTime);
      if (el.currentTime >= cap) {
        el.pause();
        el.currentTime = 0;
        setPlaying(false);
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [cap]);

  async function toggle() {
    const el = audioRef.current;
    if (!el?.src) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      await el.play().catch(() => {});
      setPlaying(true);
    }
  }

  async function confirmUnlock() {
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
      setUnlocked(true);
      await qc.invalidateQueries({ queryKey: ["profile"] });
      if (!unlockData?.already) {
        toast.success(`Full track unlocked · -${unlockData?.cost ?? unlockCost} coins`);
      }
      const { data, error } = await supabase.functions.invoke("song-url", {
        body: { song_id: song.id, mode: "full", purpose: "download" },
      });
      if (error) throw new Error(error.message || "Download failed");
      const a = document.createElement("a");
      a.href = data.url as string;
      a.download = `${title}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setUnlockOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  }

  const pct = Math.min(100, (progress / cap) * 100);

  return (
    <section
      aria-label="Your finished track"
      className="space-y-4 rounded-3xl border-2 border-emerald-400/50 bg-emerald-500/[0.07] p-5 shadow-[0_24px_70px_-32px_rgba(16,185,129,0.8)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">
            Track completed
          </p>
          <h3 className="mt-0.5 truncate font-display text-2xl font-black">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {sampleSeconds}s preview playing · full version ready to unlock
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss} className="h-8 px-2 text-xs">
          Hide
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? `Pause ${title}` : `Play ${title}`}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-emerald-400/50 bg-emerald-500/15 text-emerald-200 transition hover:bg-emerald-500/25"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 translate-x-[1px]" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            {fmt(progress)} / {fmt(cap)} preview
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Button
          type="button"
          onClick={() => setUnlockOpen(true)}
          disabled={busy}
          className="min-h-12 w-full gap-2 rounded-2xl bg-gradient-brand font-black uppercase tracking-[0.12em] text-primary-foreground shadow-glow"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : unlocked ? (
            <Download className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {unlocked ? "Download full track" : `Unlock full version · ${unlockCost} coins`}
        </Button>
        <Link to="/library/$songId" params={{ songId: song.id }} className="w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full gap-2 rounded-2xl border-white/15 font-bold sm:w-auto"
          >
            <Sparkles className="h-4 w-4" /> Edit track
          </Button>
        </Link>
      </div>

      <audio ref={audioRef} preload="auto" onEnded={() => setPlaying(false)} className="hidden" />

      <UnlockConfirmDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onConfirm={confirmUnlock}
        busy={busy}
        cost={unlockCost}
        royalty={0}
        balance={balance}
        songTitle={title}
      />
    </section>
  );
}
