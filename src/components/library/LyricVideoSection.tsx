import { useEffect, useRef, useState } from "react";
import { Film, Loader2, Lock, Unlock, Download, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { invokeError } from "@/lib/invoke-error";
import { useSettings } from "@/hooks/use-settings";
import { useProfile } from "@/hooks/use-profile";

type Props = {
  songId: string;
  songTitle: string;
  mp3Unlocked: boolean;
  onBalanceChange?: () => void;
};

type Status = "idle" | "processing" | "completed" | "failed";

export function LyricVideoSection({ songId, songTitle, mp3Unlocked, onBalanceChange }: Props) {
  const { data: settings } = useSettings();
  const { data: profile, refetch: refetchProfile } = useProfile();
  const cost = settings?.coins_per_lyric_video ?? 5;
  const balance = profile?.coin_balance ?? 0;

  const [status, setStatus] = useState<Status>("idle");
  const [videoUnlocked, setVideoUnlocked] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Initial status pull
  useEffect(() => {
    if (!mp3Unlocked) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("lyric-video", {
        body: { song_id: songId, action: "status" },
      });
      if (cancelled || error) return;
      setStatus((data?.status as Status) ?? "idle");
      setVideoUnlocked(!!data?.unlocked);
      setError(data?.error ?? null);
      if (data?.has_preview) {
        const { data: p } = await supabase.functions.invoke("lyric-video", {
          body: { song_id: songId, action: "url", mode: "preview" },
        });
        if (!cancelled && p?.url) setPreviewUrl(p.url as string);
      }
      if (data?.unlocked && data?.has_full) {
        const { data: f } = await supabase.functions.invoke("lyric-video", {
          body: { song_id: songId, action: "url", mode: "full" },
        });
        if (!cancelled && f?.url) setFullUrl(f.url as string);
      }
    })();
    return () => { cancelled = true; };
  }, [songId, mp3Unlocked]);

  async function renderPreview() {
    setRenderingPreview(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("lyric-video", {
        body: { song_id: songId, action: "render_preview" },
      });
      if (err) throw new Error(invokeError(err, "Render failed"));
      if (data?.url) {
        setPreviewUrl(data.url as string);
        setStatus("completed");
        toast.success("Preview ready");
        setTimeout(() => videoRef.current?.play().catch(() => {}), 150);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Render failed";
      setError(msg);
      setStatus("failed");
      toast.error(msg);
    } finally {
      setRenderingPreview(false);
    }
  }

  async function unlockFull() {
    setUnlocking(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("lyric-video", {
        body: { song_id: songId, action: "unlock" },
      });
      if (err) throw new Error(invokeError(err, "Unlock failed"));
      if (data?.url) setFullUrl(data.url as string);
      setVideoUnlocked(true);
      setStatus("completed");
      if (data?.cost) toast.success(`Full video unlocked · -${data.cost} coins`);
      else toast.success("Full video ready");
      refetchProfile?.();
      onBalanceChange?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unlock failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUnlocking(false);
    }
  }

  function downloadFull() {
    if (!fullUrl) return;
    const a = document.createElement("a");
    a.href = fullUrl;
    a.download = `${songTitle || "song"}-lyric-video.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (!mp3Unlocked) {
    return (
      <div className="rounded-2xl border border-white/10 bg-background/40 p-4 opacity-60">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Film className="h-4 w-4" />
          <p className="text-sm font-bold uppercase tracking-wider">Lyric video</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Unlock the MP3 first to enable the lyric video.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/5 p-4">
      <div className="flex items-center gap-2 text-fuchsia-200">
        <Film className="h-4 w-4" />
        <p className="text-sm font-bold uppercase tracking-wider">Lyric video</p>
      </div>

      {/* Player */}
      {(previewUrl || fullUrl) && (
        <video
          ref={videoRef}
          src={videoUnlocked && fullUrl ? fullUrl : previewUrl ?? undefined}
          controls
          playsInline
          className="mt-3 aspect-square w-full rounded-xl bg-black"
        />
      )}

      {!videoUnlocked && (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            Watch a free <span className="font-bold text-foreground">30-second preview</span> with the{" "}
            <span className="font-bold text-foreground">PREVIEW</span> watermark, then unlock the full lyric video for{" "}
            <span className="font-bold text-foreground">{cost} coins</span>.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={renderPreview}
              disabled={renderingPreview || !!previewUrl}
            >
              {renderingPreview ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {previewUrl ? "Preview ready" : "Render 30s preview"}
            </Button>
            <Button
              onClick={unlockFull}
              disabled={unlocking || balance < cost}
            >
              {unlocking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="mr-2 h-4 w-4" />
              )}
              {balance < cost ? "Not enough coins" : `Unlock full · ${cost} coins`}
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Balance: {balance} coins</p>
        </>
      )}

      {videoUnlocked && (
        <>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-300">
            <Unlock className="h-3.5 w-3.5" /> Full lyric video unlocked
          </p>
          <div className="mt-3 grid gap-2">
            <Button onClick={downloadFull} disabled={!fullUrl}>
              <Download className="mr-2 h-4 w-4" />
              Download MP4
            </Button>
          </div>
        </>
      )}

      {status === "failed" && error && (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
          <p className="text-xs text-rose-200">{error}</p>
          <Button size="sm" variant="ghost" className="mt-2" onClick={videoUnlocked ? unlockFull : renderPreview}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {status === "processing" && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Rendering…
        </p>
      )}
    </div>
  );
}
