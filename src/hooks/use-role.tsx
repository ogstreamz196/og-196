import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type AppRole = "admin" | "user" | "vip";

export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as AppRole);
      return {
        roles,
        isAdmin: roles.includes("admin"),
        isUser: roles.includes("user"),
        isVip: roles.includes("vip"),
      };
    },
  });
  return {
    ...query,
    isLoading: authLoading || query.isLoading,
    isAdmin: query.data?.isAdmin ?? false,
    isVip: query.data?.isVip ?? false,
    roles: query.data?.roles ?? [],
  };
}
