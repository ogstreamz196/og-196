import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Activity, KeyRound, Webhook, Map, Bug } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BossNav } from "@/components/admin/BossNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiHealthPage } from "./admin.health";
import { AdminApiKeysPage } from "./admin.api-keys";
import { WebhooksAdminPage } from "./admin.webhooks";
import { RouteMapPage } from "./admin.route-map";
import { DebugContextPage } from "./admin.debug-context";

export const Route = createFileRoute("/_authenticated/admin/system")({
  component: AdminSystemHub,
});

const TABS = [
  { value: "health", label: "Health", Icon: Activity, Panel: ApiHealthPage },
  { value: "keys", label: "API keys", Icon: KeyRound, Panel: AdminApiKeysPage },
  { value: "webhooks", label: "Webhooks", Icon: Webhook, Panel: WebhooksAdminPage },
  { value: "routes", label: "Route map", Icon: Map, Panel: RouteMapPage },
  { value: "debug", label: "Lyric debug", Icon: Bug, Panel: DebugContextPage },
] as const;

function AdminSystemHub() {
  const { isAdmin, isLoading } = useRole();

  if (isLoading) {
    return (
      <DashboardShell title="System">
        <div className="py-24 text-center text-sm text-muted-foreground">Checking admin access…</div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <DashboardShell title="System">
      <BossNav />
      <header className="mb-5 border-b border-border/60 pb-4">
        <h1 className="font-display text-2xl font-black">System</h1>
        <p className="text-sm text-muted-foreground">
          Health, keys, webhooks, routes and lyric debug — one page.
        </p>
      </header>
      <Tabs defaultValue="health" className="w-full">
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
