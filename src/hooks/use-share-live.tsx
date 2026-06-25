import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyTelegramStatus } from "@/lib/telegram-admin.functions";
import { useAuth } from "./use-auth";

/**
 * Share-live preference: when ON, messages typed in OG Messenger are posted
 * to the EXCLUSIVE OG Community shared chat instead of the private OG Bot
 * thread. Default is ON automatically once the user has linked their
 * Telegram account — that's the one trigger that flips a fresh account from
 * private chat to live shared chat.
 *
 * Stored as tri-state in localStorage:
 *   "on" | "off" | (absent) — absent means "auto": follow telegram link state.
 * The user can override manually at any time.
 */
const KEY = "og-bot:share-live";
const EVENT = "og-bot:share-live-change";

type Stored = "on" | "off" | null;

function read(): Stored {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "on" || v === "off" ? v : null;
}

export function useShareLive() {
  const { user } = useAuth();
  const [stored, setStored] = useState<Stored>(() => read());

  useEffect(() => {
    const onChange = () => setStored(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const statusFn = useServerFn(getMyTelegramStatus);
  const { data: telegram } = useQuery({
    queryKey: ["telegram-status", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: () => statusFn(),
  });

  const telegramLinked = telegram?.state === "verified" || telegram?.state === "pending";
  // Auto-on when telegram is linked and the user hasn't explicitly opted out.
  const enabled = stored === "on" || (stored === null && telegramLinked);

  const setEnabled = useCallback((next: boolean) => {
    const value: Stored = next ? "on" : "off";
    window.localStorage.setItem(KEY, value);
    window.dispatchEvent(new Event(EVENT));
    setStored(value);
  }, []);

  const reset = useCallback(() => {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
    setStored(null);
  }, []);

  return {
    enabled,
    telegramLinked: !!telegramLinked,
    isAuto: stored === null,
    setEnabled,
    reset,
  };
}
