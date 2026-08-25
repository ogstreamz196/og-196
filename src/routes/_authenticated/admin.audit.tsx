import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Scale, Users } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BossNav } from "@/components/admin/BossNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoinAuditPage } from "./admin.coin-audit";
import { ReferralsAuditPage } from "./admin.referrals-audit";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AdminAuditHub,
});

const TABS = [
  { value: "coins", label: "Coin audit", Icon: Scale, Panel: CoinAuditPage },
  { value: "referrals", label: "Referral audit", Icon: Users, Panel: ReferralsAuditPage },
] as const;

function AdminAuditHub() {
  const { isAdmin, isLoading } = useRole();

  if (isLoading) {
    return (
      <DashboardShell title="Audit">
        <div className="py-24 text-center text-sm text-muted-foreground">Checking admin access…</div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <DashboardShell title="Audit">
      <BossNav />
      <header className="mb-5 border-b border-border/60 pb-4">
        <h1 className="font-display text-2xl font-black">Audit</h1>
        <p className="text-sm text-muted-foreground">Coin ledger and referral payouts.</p>
      </header>
      <Tabs defaultValue="coins" className="w-full">
        <TabsList className="mb-5 flex h-auto w-full flex-wrap justify-start gap-4 rounded-none border-0 border-b border-border/60 bg-transparent p-0">
          {TABS.map(({ value, label, Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-0 text-sm font-bold text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ value, Panel }) => (
          <TabsContent key={value} value={value} className="mt-0">
            <Panel />
          </TabsContent>
        ))}
      </Tabs>
    </DashboardShell>
  );
}
