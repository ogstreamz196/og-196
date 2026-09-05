import { useEffect, useRef, useState } from "react";
import { usePlaylist } from "@/hooks/use-playlist";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile } from "@/lib/download-file";
import { shareTrack } from "@/lib/share-track";

interface UseSongAudioOptions {
  songId: string;
  hasAudio: boolean;
  /** When true (status === "completed" && audio available), pre-fetch the signed URL. */
  ready: boolean;
  /** Cap playback at this many seconds (preview limit). */
  sampleSeconds: number;
  /**
   * "preview" streams the short sample; "full" streams the complete master.
   * Community listeners may stream "full" for free — downloading still costs coins.
   */
  mode?: "preview" | "full";
  /** Joins the shared playlist queue (auto-advance + mini player controls). */
  playlistTitle?: string;
}

/**
 * Owns the signed-URL fetch, audio element lifecycle, sample cap, and play/pause
 * controls for a song card. Keeps `SongCard` purely presentational.
 */
export function useSongAudio({
  songId,
  hasAudio,
  ready,
  sampleSeconds,
  mode = "preview",
  playlistTitle,
}: UseSongAudioOptions) {
  const playlist = usePlaylist();
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
        body:
          mode === "full"
            ? { song_id: songId, mode: "full", purpose: "stream" }
            : { song_id: songId, mode: "preview" },
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
  }, [ready, songId, mode]);

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

  // Keep the button in sync when something else pauses us (only one track
  // may play at a time app-wide) or when the user uses OS media controls.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPause = () => setPlaying(false);
    const onPlayEvt = () => {
      setPlaying(true);
      if (playlistTitle) playlist?.markCurrent(songId);
    };
    el.addEventListener("pause", onPause);
    el.addEventListener("play", onPlayEvt);
    return () => {
      el.removeEventListener("pause", onPause);
      el.removeEventListener("play", onPlayEvt);
    };
  }, []);


  const playRef = useRef<() => Promise<void>>(async () => {});
  const pauseRef = useRef<() => void>(() => {});

  async function start() {
    const url = await ensureUrl();
    if (!url) return;
    const el = audioRef.current;
    if (!el) return;
    if (el.src !== url) el.src = url;
    await el.play();
    setPlaying(true);
  }
  playRef.current = start;
  pauseRef.current = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  // Register with the surrounding playlist so the media bar can drive us.
  useEffect(() => {
    if (!playlist || !playlistTitle) return;
    return playlist.register(songId, {
      title: playlistTitle,
      play: () => playRef.current(),
      pause: () => pauseRef.current(),
      el: () => audioRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist, songId, playlistTitle]);

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
      if (playlistTitle) playlist?.markCurrent(songId);
    }
  }

  async function download(filename: string) {
    const url = await ensureUrl();
    if (!url) return;
    const blob = await downloadFile(url, filename);
    await shareTrack({ title: filename.replace(/\.mp3$/i, ""), blob, filename });
  }


  function handleEnded() {
    setPlaying(false);
    if (playlistTitle) playlist?.handleEnded(songId);
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
