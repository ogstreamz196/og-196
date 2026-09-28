import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export type VipSubscription = {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceId: string | null;
  environment: "sandbox" | "live";
};

export function useVipSubscription() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["vip-subscription", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<VipSubscription | null> => {
      let env: "sandbox" | "live";
      try {
        env = getStripeEnvironment();
      } catch {
        return null;
      }
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "status,current_period_end,cancel_at_period_end,environment",
        )
        .eq("user_id", user!.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        status: data.status as string,
        currentPeriodEnd: (data.current_period_end as string | null) ?? null,
        cancelAtPeriodEnd: !!data.cancel_at_period_end,
        priceId: (data.price_id as string | null) ?? null,
        environment: data.environment as "sandbox" | "live",
      };
    },
  });
}
