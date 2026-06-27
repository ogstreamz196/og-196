import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyTelegramStatus } from "@/lib/telegram-admin.functions";
import { useAuth } from "./use-auth";

/**
 * Share-live preference: when ON, messages typed in OG Bot are posted
 * to the EXCLUSIVE OG Community shared chat instead of the private OG Bot
 * thread. Default is ON automatically once the user has linked their
 * Telegram account.
 *
 * Persistence: stored per-user in localStorage so the toggle is consistent
 * across refreshes and new sessions on the same device. Anonymous users get
 * a shared anon key until they sign in.
 *
 * Telegram safety: if the Telegram link is removed or fails verification,
 * Share Live is automatically forced OFF and any stored "on" preference is
 * cleared so the next link-up requires a fresh opt-in.
 *
 * Tri-state in storage:
 *   "on" | "off" | (absent) — absent means "auto": follow telegram link state.
 */
const BASE_KEY = "og-bot:share-live";
const EVENT = "og-bot:share-live-change";

type Stored = "on" | "off" | null;

function storageKey(userId: string | null | undefined) {
  return `${BASE_KEY}:${userId ?? "anon"}`;
}

function read(userId: string | null | undefined): Stored {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(storageKey(userId));
  return v === "on" || v === "off" ? v : null;
}

export function useShareLive() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [stored, setStored] = useState<Stored>(() => read(userId));

  // Re-read whenever the active user changes (sign-in/sign-out, account switch).
  useEffect(() => {
    setStored(read(userId));
  }, [userId]);

  useEffect(() => {
    const onChange = () => setStored(read(userId));
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [userId]);

  const statusFn = useServerFn(getMyTelegramStatus);
  const { data: telegram } = useQuery({
    queryKey: ["telegram-status", userId],
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: () => statusFn(),
  });

  const telegramLinked = telegram?.state === "verified" || telegram?.state === "pending";

  // If Telegram is removed or fails verification, force-clear a stored "on"
  // preference so Share Live can't keep broadcasting to the community room.
  const lastLinked = useRef<boolean | null>(null);
  useEffect(() => {
    if (!user || telegram === undefined) return;
    if (lastLinked.current === true && !telegramLinked && stored === "on") {
      window.localStorage.removeItem(storageKey(userId));
      window.dispatchEvent(new Event(EVENT));
      setStored(null);
    }
    lastLinked.current = !!telegramLinked;
  }, [telegram, telegramLinked, stored, user, userId]);

  // Hard rule: Share Live requires an active Telegram link.
  const enabled = !!telegramLinked && (stored === "on" || stored === null);

  const setEnabled = useCallback(
    (next: boolean) => {
      const value: Stored = next ? "on" : "off";
      window.localStorage.setItem(storageKey(userId), value);
      window.dispatchEvent(new Event(EVENT));
      setStored(value);
    },
    [userId],
  );

  const reset = useCallback(() => {
    window.localStorage.removeItem(storageKey(userId));
    window.dispatchEvent(new Event(EVENT));
    setStored(null);
  }, [userId]);

  return {
    enabled,
    telegramLinked: !!telegramLinked,
    isAuto: stored === null,
    setEnabled,
    reset,
  };
}
