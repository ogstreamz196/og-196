import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { PresenceTracker } from "@/hooks/use-presence";
import { SignInTracker } from "@/components/auth/SignInTracker";
import { RoyaltyCelebration } from "@/components/celebration/RoyaltyCelebration";

// Floating OG Bot widget removed site-wide. The full chat lives on /messenger.
// Location is never requested at sign-in — it stays opt-in from Settings → Privacy.

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
        <SignInTracker userId={user.id} />
        <RoyaltyCelebration userId={user.id} />
        <Outlet />
      </AppShell>
    );
  },
});
