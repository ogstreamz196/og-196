import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Single source of truth for the per-user "foul mouth" preference.
 * Reads and writes the `user_preferences.foul_mouth` row for the signed-in user.
 * Defaults to OFF — users must opt in.
 * Realtime subscribed so widget ↔ messenger toggle stays in sync across surfaces & devices.
 */
export function foulMouthQueryKey(userId: string | null | undefined) {
  return ["user-preferences", "foul_mouth", userId ?? "anon"] as const;
}

export function useFoulMouth() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: foulMouthQueryKey(uid),
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("foul_mouth")
        .eq("user_id", uid!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.foul_mouth ?? false) as boolean;
    },
  });

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`user-prefs:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_preferences", filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { foul_mouth?: boolean } | null;
          if (row && typeof row.foul_mouth === "boolean") {
            qc.setQueryData(foulMouthQueryKey(uid), row.foul_mouth);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, qc]);

  return {
    foulMouth: query.data ?? false,
    isLoading: query.isLoading,
    isReady: !!uid && query.isFetched,
  };
}

export function useSetFoulMouth() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (next: boolean) => {
      if (!uid) throw new Error("Sign in required");
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: uid, foul_mouth: next }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      return next;
    },
    onMutate: async (next) => {
      const key = foulMouthQueryKey(uid);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<boolean>(key);
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _next, ctx) => {
      if (ctx) qc.setQueryData(foulMouthQueryKey(uid), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: foulMouthQueryKey(uid) });
    },
  });
}
