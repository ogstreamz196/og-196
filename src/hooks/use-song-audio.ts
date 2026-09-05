import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile } from "@/lib/download-file";

interface UseSongAudioOptions {
  songId: string;
  hasAudio: boolean;
  /** When true (status === "completed" && audio available), pre-fetch the signed URL. */
  ready: boolean;
  /** Cap playback at this many seconds (preview limit). */
  sampleSeconds: number;
}

/**
 * Owns the signed-URL fetch, audio element lifecycle, sample cap, and play/pause
 * controls for a song card. Keeps `SongCard` purely presentational.
 */
export function useSongAudio({ songId, hasAudio, ready, sampleSeconds }: UseSongAudioOptions) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function ensureUrl(): Promise<string | null> {
    if (signedUrl) return signedUrl;
    if (!hasAudio) return null;
    setLoadingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke("song-url", {
        body: { song_id: songId, mode: "preview" },
      });
      if (error) throw error;
      const url = data.url as string;
      setSignedUrl(url);
      const el = audioRef.current;
      if (el && el.src !== url) {
        el.src = url;
        el.load();
      }
      return url;
    } finally {
      setLoadingUrl(false);
    }
  }

  // Pre-warm the signed URL once the song is ready so first-play is instant.
  useEffect(() => {
    if (!ready || signedUrl || loadingUrl) return;
    ensureUrl().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, songId]);

  // Cap preview playback.
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

  async function download(filename: string) {
    const url = await ensureUrl();
    if (!url) return;
    await downloadFile(url, filename);
  }

  function handleEnded() {
    setPlaying(false);
  }

  return {
    audioRef,
    playing,
    loadingUrl,
    progress,
    togglePlay,
    download,
    handleEnded,
  };
}
