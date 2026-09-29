import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DailyDropStatus = {
  /** True when the user has not claimed today's drop yet. */
  available: boolean;
  /** Coins won on the most recent claim (0 when never claimed). */
  lastCoins: number;
  /** UTC midnight when the next drop unlocks. */
  nextClaimAt: string;
};

export type DailyDropClaim = {
  claimed: boolean;
  coins: number;
  balance: number;
  nextClaimAt: string;
};

function nextUtcMidnight(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0),
  ).toISOString();
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Has today's free drop already been taken? */
export const getDailyDropStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyDropStatus> => {
    const { data, error } = await context.supabase
      .from("daily_drops")
      .select("coins, drop_date")
      .eq("user_id", context.userId)
      .order("drop_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const claimedToday = data?.drop_date === todayUtc();
    return {
      available: !claimedToday,
      lastCoins: data?.coins ?? 0,
      nextClaimAt: nextUtcMidnight(),
    };
  });

/**
 * Claim today's free coins. The award itself happens inside a server-only
 * atomic database routine, so retries and double taps can never pay twice.
 */
export const claimDailyDrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyDropClaim> => {
    const { data, error } = await context.supabase.rpc("claim_daily_drop");
    if (error) throw new Error(error.message);
    const result = (data ?? {}) as {
      claimed?: boolean;
      coins?: number;
      balance?: number;
      next_claim_at?: string;
    };
    return {
      claimed: !!result.claimed,
      coins: result.coins ?? 0,
      balance: result.balance ?? 0,
      nextClaimAt: result.next_claim_at ?? nextUtcMidnight(),
    };
  });
