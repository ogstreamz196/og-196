import { createFileRoute } from "@tanstack/react-router";
import { Coins, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/buy-coins")({
  component: BuyCoinsPage,
});

const tiers = [
  { coins: 10, price: 5, label: "Starter", songs: 3 },
  { coins: 30, price: 12, label: "Creator", songs: 10, popular: true },
  { coins: 100, price: 35, label: "Studio", songs: 33 },
];

function BuyCoinsPage() {
  const { data: profile } = useProfile();

  return (
    <DashboardShell title="Buy Coins">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5">
            <Coins className="h-4 w-4 text-coin" />
            <span className="text-sm">
              You have <span className="font-bold tabular-nums">{profile?.coin_balance ?? 0}</span> coins
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-bold">Top up your coins</h2>
          <p className="mt-2 text-muted-foreground">3 coins per song. Coins never expire.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.coins}
              className={cn(
                "relative rounded-2xl border bg-card p-6 shadow-card",
                t.popular ? "border-primary shadow-glow" : "border-border",
              )}
            >
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most popular
                </div>
              )}
              <div className="text-sm font-medium text-muted-foreground">{t.label}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">${t.price}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-coin">
                <Coins className="h-4 w-4" /> {t.coins} coins
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> ~{t.songs} song generations</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Free downloads</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Coins never expire</li>
              </ul>
              <Button
                className={cn("mt-6 w-full", t.popular && "bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-90")}
                variant={t.popular ? "default" : "outline"}
                disabled
              >
                <Sparkles className="mr-2 h-4 w-4" /> Coming soon
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Payments are not enabled yet. Enable Stripe to start selling coins.
        </p>
      </div>
    </DashboardShell>
  );
}
