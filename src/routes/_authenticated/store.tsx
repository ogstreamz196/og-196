import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingBag, Coins, Crown, Loader2, X, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { FlameHeading } from "@/components/ui/flame-heading";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StoreItemCard } from "@/components/store/StoreItemCard";
import { StripeEmbeddedCheckoutInline } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { CoinBalance } from "@/components/dashboard/CoinBalance";
import { listStoreCatalog } from "@/lib/store.functions";

export const Route = createFileRoute("/_authenticated/store")({
  component: StorePage,
  head: () => ({
    meta: [
      { title: "OG Store — Coins, VIP & Loot" },
      {
        name: "description",
        content: "Top up OG Coins, unlock VIP perks, and grab limited items from the OG Store.",
      },
    ],
  }),
});

function StorePage() {
  const catalog = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => useServerFn(listStoreCatalog)(),
  });
  const [buyItemId, setBuyItemId] = useState<string | null>(null);

  const returnUrl = useMemo(
    () => `${window.location.origin}/buy-coins/return?session_id={CHECKOUT_SESSION_ID}`,
    [],
  );

  const categories = catalog.data?.categories ?? [];
  const defaultTab = categories[0]?.slug ?? "coins";

  return (
    <DashboardShell title="OG Store">
      <PaymentTestModeBanner />
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
        {/* header */}
        <header className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
            <ShoppingBag className="h-7 w-7 text-primary-foreground" />
          </div>
          <FlameHeading as="h1" size="2xl">OG Store</FlameHeading>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Coins, VIP memberships, and limited-drop items. Every purchase is instant.
          </p>
          <div className="mt-4 flex justify-center">
            <CoinBalance />
          </div>
        </header>

        {/* quick CTAs */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/buy-coins"
            className="group rounded-2xl border border-coin/30 bg-coin/5 p-4 transition hover:bg-coin/10"
          >
            <div className="flex items-center gap-3">
              <Coins className="h-6 w-6 text-coin" />
              <div>
                <div className="font-display text-sm font-bold uppercase tracking-wider">Custom coin top-up</div>
                <div className="text-xs text-muted-foreground">Pick any amount — pay by the coin.</div>
              </div>
            </div>
          </Link>
          <Link
            to="/buy-coins"
            className="group rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 transition hover:bg-amber-500/10"
          >
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-amber-400" />
              <div>
                <div className="font-display text-sm font-bold uppercase tracking-wider">Go VIP</div>
                <div className="text-xs text-muted-foreground">Priority queue + perks.</div>
              </div>
            </div>
          </Link>
        </div>

        {/* catalog */}
        {catalog.isLoading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : catalog.error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive">
            Couldn’t load the store. Try refreshing.
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No items in the store yet. Boss can add products in Admin → Store.
            </p>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="mx-auto flex w-full max-w-2xl flex-wrap justify-center gap-2 rounded-full bg-card/60 p-1.5">
              {categories.map((c) => (
                <TabsTrigger
                  key={c.slug}
                  value={c.slug}
                  className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-gradient-brand data-[state=active]:text-primary-foreground"
                >
                  {c.label}
                  {c.items.length > 0 && (
                    <span className="ml-2 rounded-full bg-black/30 px-1.5 text-[10px] font-bold">
                      {c.items.length}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((c) => (
              <TabsContent key={c.slug} value={c.slug} className="mt-6">
                {c.description && (
                  <p className="mb-4 text-center text-sm text-muted-foreground">{c.description}</p>
                )}
                {c.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Nothing here yet.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {c.items.map((item) => (
                      <StoreItemCard
                        key={item.id}
                        item={item}
                        onBuy={setBuyItemId}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* embedded checkout */}
      <Dialog open={!!buyItemId} onOpenChange={(o) => !o && setBuyItemId(null)}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="border-b border-border p-4">
            <DialogTitle className="flex items-center justify-between">
              <span className="font-display uppercase tracking-wider">Secure checkout</span>
              <Button variant="ghost" size="sm" onClick={() => setBuyItemId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {buyItemId && (
              <StripeEmbeddedCheckoutInline
                type="store_item"
                storeItemId={buyItemId}
                returnUrl={returnUrl}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
