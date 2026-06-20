import { useCallback, useEffect, useState } from "react";

/**
 * Local-only preferences for the assistant + music workspace.
 * Per-browser via localStorage; safe to upgrade to a DB column later
 * without changing call sites.
 */
const KEY = "og-studio:prefs:v1";
const EVENT = "og-studio:prefs-change";

export type Theme = "system" | "light" | "dark";

export interface AppPreferences {
  theme: Theme;
  notifySongReady: boolean;
  notifyMessenger: boolean;
  defaultMood: string;
  defaultGenre: string;
  defaultLyricalStyle: string;
}

export const DEFAULTS: AppPreferences = {
  theme: "system",
  notifySongReady: true,
  notifyMessenger: false,
  defaultMood: "",
  defaultGenre: "",
  defaultLyricalStyle: "",
};

function read(): AppPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppPreferences>) };
  } catch {
    return DEFAULTS;
  }
}

export function useAppPreferences() {
  const [prefs, setPrefs] = useState<AppPreferences>(() => read());

  useEffect(() => {
    const onChange = () => setPrefs(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = useCallback(<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    const next = { ...read(), [key]: value };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
    setPrefs(next);
  }, []);

  return { prefs, update };
}
