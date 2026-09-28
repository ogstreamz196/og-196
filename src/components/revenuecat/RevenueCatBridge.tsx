import { Suspense, lazy } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

// The RevenueCat Web SDK is browser-only, so the provider is loaded lazily
// after hydration and never evaluated during SSR.
const RevenueCatProvider = lazy(() =>
  import("./RevenueCatProvider").then((m) => ({ default: m.RevenueCatProvider })),
);

export function RevenueCatBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <ClientOnly fallback={<>{children}</>}>
      <Suspense fallback={<>{children}</>}>
        <RevenueCatProvider userId={user?.id}>{children}</RevenueCatProvider>
      </Suspense>
    </ClientOnly>
  );
}
