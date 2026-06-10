// Single source of truth for purchasable coin packs.
// Used by both the client (Buy Coins page) and the server (checkout + webhook
// validation). Keep `priceId` in sync with payments--batch_create_product.

export interface CoinPack {
  bundleId: string;
  priceId: string;
  coins: number;
  priceCents: number;
  currency: "usd";
  label: string;
  description: string;
  popular?: boolean;
}

export const COIN_PACKS: readonly CoinPack[] = [
  {
    bundleId: "coins_10",
    priceId: "coins_10_usd",
    coins: 10,
    priceCents: 500,
    currency: "usd",
    label: "Starter",
    description: "~3 song generations",
  },
  {
    bundleId: "coins_50",
    priceId: "coins_50_usd",
    coins: 50,
    priceCents: 1900,
    currency: "usd",
    label: "Creator",
    description: "~16 song generations",
    popular: true,
  },
  {
    bundleId: "coins_200",
    priceId: "coins_200_usd",
    coins: 200,
    priceCents: 6900,
    currency: "usd",
    label: "Studio",
    description: "~66 song generations",
  },
  {
    bundleId: "coins_500",
    priceId: "coins_500_usd",
    coins: 500,
    priceCents: 14900,
    currency: "usd",
    label: "Producer",
    description: "~166 song generations",
  },
] as const;

export function findCoinPackByPriceId(priceId: string): CoinPack | undefined {
  return COIN_PACKS.find((p) => p.priceId === priceId);
}

export function findCoinPackByBundleId(bundleId: string): CoinPack | undefined {
  return COIN_PACKS.find((p) => p.bundleId === bundleId);
}
