import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { OgBotWidget } from "@/components/messenger/OgBotWidget";
import { PresenceTracker } from "@/hooks/use-presence";
import { SignInTracker } from "@/components/auth/SignInTracker";
import { PermissionsGate } from "@/components/auth/PermissionsGate";

function TrackerLoader({ userId }: { userId: string }) {
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    let cancel = false;
    supabase
      .from("profiles")
      .select("gps_consent")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancel) setConsent(Boolean(data?.gps_consent));
      });
    return () => {
      cancel = true;
    };
  }, [userId]);
  return <SignInTracker userId={userId} gpsConsent={consent} />;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/welcome" });
    return { user: data.user };
  },
  component: function AuthedLayout() {
    const { user } = Route.useRouteContext();
    return (
      <AppShell>
        <PresenceTracker />
        <TrackerLoader userId={user.id} />
        <Outlet />
        <OgBotWidget />
      </AppShell>
    );
  },
});
