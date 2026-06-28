import { useCallback, useEffect, useState } from "react";

/**
 * Background red-aura intensity. Stored per-browser in localStorage and
 * applied to <html data-aura="..."> so styles.css can scale the effect.
 */
export type AuraLevel = "off" | "low" | "medium" | "high";

const KEY = "og:aura-level";
const VALID: AuraLevel[] = ["off", "low", "medium", "high"];

function read(): AuraLevel {
  if (typeof window === "undefined") return "medium";
  const v = window.localStorage.getItem(KEY) as AuraLevel | null;
  return v && VALID.includes(v) ? v : "medium";
}

function apply(level: AuraLevel) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.aura = level;
}

export function useAura() {
  const [level, setLevelState] = useState<AuraLevel>(() => read());

  useEffect(() => {
    apply(level);
  }, [level]);

  const setLevel = useCallback((next: AuraLevel) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    setLevelState(next);
  }, []);

  return { level, setLevel };
}

export function AuraBridge() {
  useAura();
  return null;
}
