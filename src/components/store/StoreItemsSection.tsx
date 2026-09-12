import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PackageOpen, X } from "lucide-react";
import { toast } from "sonner";
import { StripeEmbeddedCheckoutInline } from "@/components/StripeEmbeddedCheckout";
import { StoreItemCard } from "@/components/store/StoreItemCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getSportsGuideAccessStatus,
  listStoreCatalog,
  purchaseSportsGuideAccess,
} from "@/lib/store.functions";

const ALL_ITEMS = "all";

export function StoreItemsSection() {
  const queryClient = useQueryClient();
  const getAccessStatus = useServerFn(getSportsGuideAccessStatus);
  const purchaseAccess = useServerFn(purchaseSportsGuideAccess);
  const [checkoutItemId, setCheckoutItemId] = useState<string | null>(null);
  const catalog = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => listStoreCatalog(),
  });
  const access = useQuery({
    queryKey: ["sports-guide-access"],
    queryFn: () => getAccessStatus(),
  });
  const categories = catalog.data?.categories ?? [];
  const allItems = useMemo(() => categories.flatMap((category) => category.items), [categories]);
  const returnUrl = useMemo(
    () => `${typeof window === "undefined" ? "" : window.location.origin}/buy-coins/return?session_id={CHECKOUT_SESSION_ID}`,
    [],
  );

  const sportsGuide = useMutation({
    mutationFn: () => purchaseAccess(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sports-guide-access"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["coin-transactions"] }),
      ]);
      toast.success("Sports Guide access unlocked — your private link is ready");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const buy = (itemId: string) => {
    const item = allItems.find((candidate) => candidate.id === itemId);
    if (item?.slug === "og-sports-guide-access") {
      sportsGuide.mutate();
      return;
    }
    setCheckoutItemId(itemId);
  };

  const renderItem = (item: (typeof allItems)[number]) => (
    <StoreItemCard
      key={item.id}
      item={item}
      onBuy={buy}
      buying={item.slug === "og-sports-guide-access" && sportsGuide.isPending}
      sportsGuideState={item.slug === "og-sports-guide-access" ? access.data?.status : undefined}
      sportsGuideInviteUrl={item.slug === "og-sports-guide-access" ? access.data?.inviteUrl ?? undefined : undefined}
    />
  );

  return (
    <section aria-labelledby="store-items-heading" className="scroll-mt-24">
      <div className="mb-3 flex items-center gap-2">
        <PackageOpen className="h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Member access & extras</p>
          <h2 id="store-items-heading" className="font-display text-xl font-black">Store items</h2>
        </div>
      </div>

      {catalog.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : catalog.error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-center text-sm text-destructive">Couldn’t load Store items. Try refreshing.</div>
      ) : allItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No Store items are available yet.</div>
      ) : (
        <Tabs defaultValue={ALL_ITEMS}>
          <TabsList className="flex h-auto w-full max-w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-card p-1">
            <TabsTrigger value={ALL_ITEMS}>All</TabsTrigger>
            {categories.map((category) => <TabsTrigger key={category.id} value={category.slug}>{category.label}</TabsTrigger>)}
          </TabsList>
          <TabsContent value={ALL_ITEMS} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{allItems.map(renderItem)}</TabsContent>
          {categories.map((category) => (
            <TabsContent key={category.id} value={category.slug} className="mt-4">
              {category.description ? <p className="mb-3 text-sm text-muted-foreground">{category.description}</p> : null}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{category.items.map(renderItem)}</div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Dialog open={!!checkoutItemId} onOpenChange={(open) => !open && setCheckoutItemId(null)}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="border-b border-border p-4">
            <DialogTitle className="flex items-center justify-between">
              <span>Secure checkout</span>
              <Button variant="ghost" size="icon" onClick={() => setCheckoutItemId(null)} aria-label="Close checkout"><X className="h-4 w-4" /></Button>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {checkoutItemId ? <StripeEmbeddedCheckoutInline type="store_item" storeItemId={checkoutItemId} returnUrl={returnUrl} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}