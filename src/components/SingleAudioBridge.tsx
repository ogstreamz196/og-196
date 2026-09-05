import { useEffect } from "react";

/**
 * Only one track plays at a time.
 *
 * Every player in the app renders its own <audio> element, so instead of
 * threading shared state through them we listen for `play` in the capture
 * phase at the document level and pause whichever media element was playing
 * before. Works for library rows, inline previews, the finished-track card
 * and anything added later — no wiring needed.
 */
export function SingleAudioBridge() {
  useEffect(() => {
    const onPlay = (e: Event) => {
      const started = e.target as HTMLMediaElement | null;
      if (!started || !("pause" in started)) return;
      const all = document.querySelectorAll<HTMLMediaElement>("audio, video");
      all.forEach((el) => {
        if (el !== started && !el.paused) {
          el.pause();
          // Let the paused player fire its own "pause" event so its UI resets.
          el.dispatchEvent(new Event("og:paused-by-other"));
        }
      });
    };
    document.addEventListener("play", onPlay, true);
    return () => document.removeEventListener("play", onPlay, true);
  }, []);

  return null;
}
