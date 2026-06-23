import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useFreeAccess } from "./use-free-access";



export type AppRole = "admin" | "user" | "vip" | "og_bot" | "dev" | "boss";

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
      const isAdmin = roles.includes("admin");
      return {
        roles,
        isAdmin,
        isUser: roles.includes("user"),
        isVip: roles.includes("vip"),
        isDev: roles.includes("dev") || isAdmin,
        isBoss: roles.includes("boss") || isAdmin,
      };
    },
  });
  return {
    ...query,
    isLoading: authLoading || query.isLoading,
    isAdmin: query.data?.isAdmin ?? false,
    isVip: query.data?.isVip ?? false,
    isDev: query.data?.isDev ?? false,
    isBoss: query.data?.isBoss ?? false,
    roles: query.data?.roles ?? [],
  };
}
