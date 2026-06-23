import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useFreeAccess } from "./use-free-access";



export type AppRole = "admin" | "user" | "vip" | "og_bot" | "dev" | "boss";

export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const { enabled: freeAccess } = useFreeAccess();
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
      const isAdmin = roles.includes("admin");
      return {
        roles,
        isAdmin,
        isUser: roles.includes("user"),
        hasVipRole: roles.includes("vip"),
        isDev: roles.includes("dev") || isAdmin,
        isBoss: roles.includes("boss") || isAdmin,
      };
    },
  });
  const hasVipRole = query.data?.hasVipRole ?? false;
  const isAdmin = query.data?.isAdmin ?? false;
  // VIP-gated features are unlocked for everyone while the dev-controlled
  // free_access_all flag is ON. Admins always have access.
  const isVip = hasVipRole || isAdmin || freeAccess;
  return {
    ...query,
    isLoading: authLoading || query.isLoading,
    isAdmin,
    isVip,
    hasVipRole,
    isFreeAccess: freeAccess,
    isDev: query.data?.isDev ?? false,
    isBoss: query.data?.isBoss ?? false,
    roles: query.data?.roles ?? [],
  };
}

