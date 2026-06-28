import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

/**
 * Single source of truth for the per-user OG Bot messenger mode.
 * Reads/writes `user_preferences.messenger_mode` ('loner' | 'community').
 * Everyone defaults to loner until they explicitly switch.
 * Realtime-subscribed so the toggle stays in sync across tabs/devices.
 */
export type MessengerMode = "loner" | "community";

export function messengerModeQueryKey(userId: string | null | undefined) {
  return ["user-preferences", "messenger_mode", userId ?? "anon"] as const;
}

export function useMessengerMode() {
  const { user } = useAuth();
  const { isVip } = useRole();
  const uid = user?.id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: messengerModeQueryKey(uid),
    enabled: !!uid,
    queryFn: async (): Promise<MessengerMode | null> => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("messenger_mode")
        .eq("user_id", uid!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const stored = data?.messenger_mode as MessengerMode | null | undefined;
      return stored === "community" || stored === "loner" ? stored : null;
    },
  });

  // Seed VIPs into community mode once if they've never picked a preference.
  useEffect(() => {
    if (!uid || !query.isFetched || !isVip) return;
    if (query.data !== null) return;
    void supabase
      .from("user_preferences")
      .upsert({ user_id: uid, messenger_mode: "community" }, { onConflict: "user_id" })
      .then(({ error }) => {
        if (!error) {
          qc.setQueryData(messengerModeQueryKey(uid), "community");
        }
      });
  }, [uid, isVip, query.isFetched, query.data, qc]);

  useEffect(() => {
    if (!uid) return;
    const channel = supabase.channel(
      `user-prefs-mode:${uid}:${Math.random().toString(36).slice(2, 10)}`,
    );
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_preferences", filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { messenger_mode?: MessengerMode } | null;
          if (row && (row.messenger_mode === "loner" || row.messenger_mode === "community")) {
            qc.setQueryData(messengerModeQueryKey(uid), row.messenger_mode);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, qc]);

  const effectiveMode: MessengerMode =
    query.data ?? (isVip ? "community" : "loner");

  return {
    mode: effectiveMode,
    isLoading: query.isLoading,
    isReady: !!uid && query.isFetched,
  };
}


export function useSetMessengerMode() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (next: MessengerMode) => {
      if (!uid) throw new Error("Sign in required");
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: uid, messenger_mode: next }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      return next;
    },
    onMutate: async (next) => {
      const key = messengerModeQueryKey(uid);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MessengerMode>(key);
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _next, ctx) => {
      if (ctx) qc.setQueryData(messengerModeQueryKey(uid), ctx.prev);
      toast.error("Couldn't save messenger mode");
    },
    onSuccess: (next) => {
      toast.success(
        next === "community" ? "👥 OG Community Mode: ON" : "🤖 OG Bot Loner Mode: ON",
        {
          id: "messenger-mode-toggle",
          description:
            next === "community"
              ? "You're now in the public OG Community room. Saved to your profile."
              : "Back to private chat with OG Bot. Saved to your profile.",
        },
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: messengerModeQueryKey(uid) });
    },
  });
}
