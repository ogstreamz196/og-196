import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useRole } from "@/hooks/use-role";
import { useRecentSongs } from "@/hooks/use-recent-songs";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { HomeHero } from "@/components/home/HomeHero";
import { FeatureGrid } from "@/components/home/FeatureGrid";
import { EngineHighlight } from "@/components/home/EngineHighlight";
import { RecentCreations } from "@/components/home/RecentCreations";
import { PortalVipCta } from "@/components/home/PortalVipCta";
import { CoinsCta } from "@/components/home/CoinsCta";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { isAdmin, isVip } = useRole();
  const { data: recentSongs = [] } = useRecentSongs(user?.id);

  return (
    <DashboardShell title="Music Hub">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <HomeHero balance={profile?.coin_balance ?? 0} isAdmin={isAdmin} isVip={isVip} />
        <FeatureGrid />
        <EngineHighlight />
        <RecentCreations songs={recentSongs} />
        <PortalVipCta />
        <CoinsCta />
      </div>
    </DashboardShell>
  );
}
