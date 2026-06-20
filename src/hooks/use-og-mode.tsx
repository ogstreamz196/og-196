import { useCallback, useEffect, useState } from "react";

/**
 * Per-browser preference for OG Bot tone mode.
 * - "safe": always family-safe, no swearing regardless of foulMouth.
 * - "og":   British banter persona; goes fully savage only when foulMouth=true.
 *
 * Stored in localStorage so it survives reloads but doesn't need a DB column.
 */
const KEY = "og-bot:mode";
const EVENT = "og-bot:mode-change";
export type OgMode = "safe" | "og";

function read(): OgMode {
  if (typeof window === "undefined") return "og";
  const v = window.localStorage.getItem(KEY);
  return v === "safe" ? "safe" : "og";
}

export function useOgMode() {
  const [mode, setModeState] = useState<OgMode>(() => read());

  useEffect(() => {
    function onChange() {
      setModeState(read());
    }
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setMode = useCallback((next: OgMode) => {
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event(EVENT));
    setModeState(next);
  }, []);

  const toggle = useCallback(() => {
    setMode(read() === "og" ? "safe" : "og");
  }, [setMode]);

  return { mode, setMode, toggle };
}
