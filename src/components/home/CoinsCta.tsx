import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";

export function CoinsCta() {
  return (
    <section className="w-full rounded-2xl border border-border bg-card/60 p-8 text-center shadow-card">
      <h3 className="font-bungee text-3xl sm:text-4xl">Running low on coins?</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Top up your OG coins to keep creating. Choose from coin packs or grab a VIP membership for unlimited perks.
      </p>
      <Link
        to="/buy-coins"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        <Coins className="h-4 w-4" /> Buy Coins & VIP
      </Link>
    </section>
  );
}
