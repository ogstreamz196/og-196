import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = ["site-content"] as const;

interface Row { key: string; value: string }

export function useSiteContent() {
  const q = useQuery({
    queryKey: KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_content")
        .select("key, value");
      if (error) throw error;
      const map = new Map<string, string>();
      ((data ?? []) as Row[]).forEach((r) => map.set(r.key, r.value));
      return map;
    },
  });

  function get(key: string, fallback: string): string {
    const v = q.data?.get(key);
    return v == null || v === "" ? fallback : v;
  }

  return { map: q.data, get, isLoading: q.isLoading };
}

export function useSetSiteContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      // Client-side boss guard. The DB enforces this too (set_site_content
      // RPC + RLS), but we block the call early so non-boss users never
      // even attempt the write.
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sign in required");
      const { data: roles, error: roleErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .limit(1);
      if (roleErr) throw new Error(roleErr.message);
      if (!roles || roles.length === 0) {
        throw new Error("Boss role required to edit site content.");
      }

      const { data, error } = await supabase.rpc("set_site_content", {
        p_key: key,
        p_value: value,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
