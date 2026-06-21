import { createServerFn } from "@tanstack/react-start";

/**
 * Public, unauthenticated read of OG coin economy stats.
 *
 *  - minted    : total coins ever issued (sum of all positive ledger entries).
 *  - inWallets : coins currently held across all profiles. Acts as the
 *                "circulating supply" — coins decrease as users spend them
 *                (tokens are burnt after use).
 *  - burnt     : minted − inWallets, surfaced for clarity in the UI.
 *
 * Uses the admin client because PostgREST aggregate reads against
 * coin_transactions / profiles are intentionally locked down; this fn only
 * returns three integers, no PII, so it's safe to expose publicly.
 */
export const getCoinStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [mintedRes, walletsRes] = await Promise.all([
    supabaseAdmin.from("coin_transactions").select("amount").gt("amount", 0),
    supabaseAdmin.from("profiles").select("coin_balance"),
  ]);

  const minted = (mintedRes.data ?? []).reduce(
    (sum, row) => sum + (row.amount ?? 0),
    0,
  );
  const inWallets = (walletsRes.data ?? []).reduce(
    (sum, row) => sum + (row.coin_balance ?? 0),
    0,
  );
  const burnt = Math.max(0, minted - inWallets);

  return { minted, inWallets, burnt };
});
