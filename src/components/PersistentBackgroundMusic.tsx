import { Music2, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import backgroundTrack from "@/assets/og-bot-background.mp3.asset.json";
import { Button } from "@/components/ui/button";

const ENABLED_KEY = "og:background-music-enabled";
const POSITION_KEY = "og:background-music-position";

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

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
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
        const unlock = () => {
          if (!enabledRef.current) return;
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
      {ready ? (
        <div className="fixed right-3 z-50 flex items-center gap-1.5 rounded-full border border-border bg-popover/95 p-1.5 pr-2.5 text-popover-foreground shadow-lg backdrop-blur-md bottom-[calc(5.25rem+env(safe-area-inset-bottom))] sm:bottom-4 sm:right-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={() => void toggle()}
            aria-label={playing ? "Pause background music" : "Play background music"}
            title={playing ? "Pause background music" : "Play background music"}
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </Button>
          <Music2 className="size-3.5 text-primary" aria-hidden />
          <span className="max-w-24 truncate text-[10px] font-semibold">OG BOT</span>
        </div>
      ) : null}
    </>
  );
}