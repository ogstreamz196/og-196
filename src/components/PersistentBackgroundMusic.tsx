import { Music2, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import backgroundTrack from "@/assets/og-bot-background.mp3.asset.json";
import { Button } from "@/components/ui/button";

const ENABLED_KEY = "og:background-music-enabled";
const POSITION_KEY = "og:background-music-position";
const TOGGLE_EVENT = "og:background-music-toggle";
const STATUS_EVENT = "og:background-music-status";
const STATUS_REQUEST_EVENT = "og:background-music-status-request";

function announceStatus(playing: boolean) {
  window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { playing } }));
}

export function BackgroundMusicHeaderControl({ className = "" }: { className?: string }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ playing?: boolean }>).detail;
      setPlaying(Boolean(detail?.playing));
    };
    window.addEventListener(STATUS_EVENT, update);
    window.dispatchEvent(new Event(STATUS_REQUEST_EVENT));
    return () => window.removeEventListener(STATUS_EVENT, update);
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-9 w-9 shrink-0 rounded-full hover:bg-white/5 ${className}`}
      onClick={() => window.dispatchEvent(new Event(TOGGLE_EVENT))}
      aria-label={playing ? "Pause background music" : "Play background music"}
      title={playing ? "Pause background music" : "Play background music"}
      data-background-music-control
    >
      {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
      <span className="sr-only">{playing ? "Pause background music" : "Play background music"}</span>
    </Button>
  );
}

/**
 * One audio element mounted above the router outlet, so client-side page
 * changes never interrupt or restart the soundtrack.
 */
export function PersistentBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  const start = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;
    try {
      await audio.play();
      setPlaying(true);
      return true;
    } catch {
      setPlaying(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const storedEnabled = window.localStorage.getItem(ENABLED_KEY);
    enabledRef.current = storedEnabled !== "0";

    const storedPosition = Number(window.localStorage.getItem(POSITION_KEY));
    if (Number.isFinite(storedPosition) && storedPosition > 0) {
      audio.currentTime = storedPosition;
    }

    const onPlay = () => {
      setPlaying(true);
      announceStatus(true);
    };
    const onPause = () => {
      setPlaying(false);
      announceStatus(false);
    };
    const savePosition = () => {
      if (Number.isFinite(audio.currentTime)) {
        window.localStorage.setItem(POSITION_KEY, String(audio.currentTime));
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    window.addEventListener("pagehide", savePosition);
    const saveTimer = window.setInterval(savePosition, 5_000);
    setReady(true);

    let removeUnlockListeners = () => undefined;
    if (enabledRef.current) {
      void start().then((started) => {
        if (started) return;

        // iOS and most mobile browsers require one genuine interaction before
        // starting audible media. The persistent control remains available if
        // the visitor declines or the browser still blocks playback.
        const unlock = (event: Event) => {
          if (!enabledRef.current) return;
          if (event.target instanceof Element && event.target.closest("[data-background-music-control]")) {
            return;
          }
          const otherMediaPlaying = Array.from(
            document.querySelectorAll<HTMLMediaElement>("audio:not([data-background-music]), video"),
          ).some((media) => !media.paused && !media.ended);
          if (otherMediaPlaying) return;
          void start().then((unlocked) => {
            if (unlocked) removeUnlockListeners();
          });
        };
        document.addEventListener("pointerup", unlock, { passive: true });
        document.addEventListener("keydown", unlock);
        removeUnlockListeners = () => {
          document.removeEventListener("pointerup", unlock);
          document.removeEventListener("keydown", unlock);
        };
      });
    }

    return () => {
      savePosition();
      removeUnlockListeners();
      window.clearInterval(saveTimer);
      window.removeEventListener("pagehide", savePosition);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [start]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      enabledRef.current = false;
      window.localStorage.setItem(ENABLED_KEY, "0");
      audio.pause();
      return;
    }

    enabledRef.current = true;
    window.localStorage.setItem(ENABLED_KEY, "1");
    await start();
  };

  useEffect(() => {
    if (!ready) return;
    const handleToggle = () => void toggle();
    const reportStatus = () => announceStatus(playing);
    window.addEventListener(TOGGLE_EVENT, handleToggle);
    window.addEventListener(STATUS_REQUEST_EVENT, reportStatus);
    announceStatus(playing);
    return () => {
      window.removeEventListener(TOGGLE_EVENT, handleToggle);
      window.removeEventListener(STATUS_REQUEST_EVENT, reportStatus);
    };
  }, [playing, ready]);

  return (
    <>
      <audio
        ref={audioRef}
        src={backgroundTrack.url}
        loop
        preload="auto"
        className="hidden"
        data-background-music
      />
    </>
  );
}