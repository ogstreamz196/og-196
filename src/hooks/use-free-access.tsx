import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Global "free access for everyone" flag, stored in app_settings.
 * Dev/admin can toggle it from the developer dashboard. When ON, all
 * signed-in users get VIP-only features (incl. OG Bot foul-mouth mode).
 */
export const FREE_ACCESS_KEY = ["app-setting", "free_access_all"] as const;

export function useFreeAccess() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: FREE_ACCESS_KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "free_access_all")
        .maybeSingle();
      if (error) return false;
      const v = data?.value as unknown;
      return v === true || v === "true";
    },
  });

  useEffect(() => {
    const channel = supabase.channel(
      `app-settings-free:${Math.random().toString(36).slice(2, 10)}`,
    );
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.free_access_all" },
        () => qc.invalidateQueries({ queryKey: FREE_ACCESS_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return { enabled: query.data ?? false, isLoading: query.isLoading };
}

export function useSetFreeAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "free_access_all", value: next as unknown as never }, { onConflict: "key" });
      if (error) throw new Error(error.message);
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(FREE_ACCESS_KEY, next);
      qc.invalidateQueries({ queryKey: ["user-role"] });
      toast.success(next ? "Free access ON for all users" : "Free access OFF — VIP-only restored");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
