// Single source of truth for purchasable coin packs and the VIP subscription.
// Used by both the client (Buy Coins page) and the server (checkout + webhook
// validation). Keep `priceId` in sync with payments--batch_create_product.

export interface CoinPack {
  bundleId: string;
  priceId: string;
  coins: number;
  priceCents: number;
  currency: "gbp";
  label: string;
  description: string;
  popular?: boolean;
}

export const CURRENCY_SYMBOL = "£";

export const COIN_PACKS: readonly CoinPack[] = [
  {
    bundleId: "coins_50",
    priceId: "coins_50_gbp",
    coins: 50,
    priceCents: 999,
    currency: "gbp",
    label: "Starter",
    description: "50 OG coins — great for casual chats and a few generations.",
  },
  {
    bundleId: "coins_120",
    priceId: "coins_120_gbp",
    coins: 120,
    priceCents: 1999,
    currency: "gbp",
    label: "Power",
    description: "120 OG coins — best value for active creators.",
    popular: true,
  },
] as const;

export interface VipPlan {
  bundleId: "vip_yearly";
  priceId: "vip_yearly_gbp";
  priceCents: number;
  currency: "gbp";
  label: string;
}

export const VIP_PLAN: VipPlan = {
  bundleId: "vip_yearly",
  priceId: "vip_yearly_gbp",
  priceCents: 2000,
  currency: "gbp",
  label: "OG VIP — Yearly",
};

export function findCoinPackByPriceId(priceId: string): CoinPack | undefined {
  return COIN_PACKS.find((p) => p.priceId === priceId);
}

export function findCoinPackByBundleId(bundleId: string): CoinPack | undefined {
  return COIN_PACKS.find((p) => p.bundleId === bundleId);
}

export function isVipBundle(bundleId: string | undefined): boolean {
  return bundleId === VIP_PLAN.bundleId;
}
