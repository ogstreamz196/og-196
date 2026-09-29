import { useState } from "react";
import { Check, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRevenueCat } from "./RevenueCatProvider";
import { showCustomerCenter } from "@/lib/revenuecat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MONTHLY_PLAN = {
  title: "OG VIP Monthly",
  price: "£4.99",
  period: "/month",
  description: "Full VIP access, billed monthly. Cancel any time.",
};

const YEARLY_PLAN = {
  title: "VIP Yearly",
  price: "£50",
  period: "/year",
  description: "Full VIP access for a whole year — two months free versus monthly.",
};

export function Paywall() {
  const { offerings, loading, purchasePackage, isVip } = useRevenueCat();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const rawOffering = offerings?.current;
  // The Current offering also holds coin packs (coins_*, track_unlock_99p); the VIP paywall shows only subscriptions.
  const currentOffering = rawOffering
    ? {
        ...rawOffering,
        availablePackages: rawOffering.availablePackages.filter((p) => {
          const a = p as unknown as {
            identifier: string;
            product?: { identifier?: string };
            webBillingProduct?: { identifier?: string };
          };
          const id = `${a.identifier} ${a.product?.identifier ?? ""} ${a.webBillingProduct?.identifier ?? ""}`;
          return !/coins_|track_unlock/.test(id);
        }),
      }
    : undefined;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading subscription details…
        </CardContent>
      </Card>
    );
  }

  if (isVip) {
    return (
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-4 w-4 text-primary" /> You are VIP
          </CardTitle>
          <CardDescription>Enjoy your premium features.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void showCustomerCenter()}>
            Manage subscription
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!currentOffering || currentOffering.availablePackages.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No subscription packages available at the moment.
        </CardContent>
      </Card>
    );
  }

  const handlePurchase = async (pkg: (typeof currentOffering.availablePackages)[number]) => {
    setPurchasing(pkg.identifier);
    try {
      const success = await purchasePackage(pkg);
      if (success) toast.success("Welcome to VIP!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed or cancelled.");
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-2xl">
          <Crown className="h-5 w-5 text-primary" /> Unlock OG VIP Pass
        </CardTitle>
        <CardDescription>Get unlimited access to all premium features.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {currentOffering.availablePackages.map((pkg) => {
            // Google Play product IDs: og_vip_monthly / og_vip_yearly (native),
            // web billing product, or RevenueCat package identifiers ($rc_annual).
            const anyPkg = pkg as unknown as {
              identifier: string;
              product?: { identifier?: string };
              webBillingProduct?: { identifier?: string };
            };
            const productId =
              anyPkg.product?.identifier ?? anyPkg.webBillingProduct?.identifier ?? "";
            const isYearly =
              productId.startsWith("og_vip_yearly") ||
              /year|annual/i.test(`${pkg.identifier} ${productId}`);
            const busy = purchasing === pkg.identifier;
            const plan = isYearly ? YEARLY_PLAN : MONTHLY_PLAN;
            return (
              <div
                key={pkg.identifier}
                className={cn(
                  "flex flex-col rounded-2xl border p-5",
                  isYearly ? "border-primary/60 bg-primary/10" : "border-border bg-card",
                )}
              >
                {isYearly && (
                  <Badge className="mb-2 w-fit bg-gradient-brand text-primary-foreground shadow-glow">
                    Best value
                  </Badge>
                )}
                <h3 className="text-lg font-bold">{plan.title}</h3>
                <div className="mb-1 text-2xl font-black">
                  {plan.price}
                  <span className="text-sm font-semibold text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mb-5 flex-grow text-sm text-muted-foreground">{plan.description}</p>

                <Button
                  disabled={purchasing !== null}
                  onClick={() => void handlePurchase(pkg)}
                  className={cn(
                    "w-full",
                    isYearly && "bg-gradient-brand text-primary-foreground shadow-glow",
                  )}
                  variant={isYearly ? "default" : "outline"}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {busy ? "Processing…" : `Subscribe ${isYearly ? "yearly" : "monthly"}`}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
