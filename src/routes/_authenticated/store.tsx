import { createFileRoute } from "@tanstack/react-router";
import { CoinStore } from "./buy-coins.index";

export const Route = createFileRoute("/_authenticated/store")({
  validateSearch: (search: Record<string, unknown>): { edit?: 1 } => ({
    edit: search.edit === "1" || search.edit === 1 || search.edit === true ? 1 : undefined,
  }),
  component: StorePage,
  head: () => ({
    meta: [
      { title: "OG Store — Coins, VIP & Loot" },
      {
        name: "description",
        content: "Shop limited items, buy OG Coins, unlock VIP perks, and review purchases in the OG BOT Store.",
      },
      { property: "og:title", content: "OG Store — Items, Coins & VIP" },
      { property: "og:description", content: "Shop limited items, buy OG Coins, unlock VIP perks, and review purchases in the OG BOT Store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function StorePage() {
  const search = Route.useSearch();
  return <CoinStore editMode={search.edit} />;
}
