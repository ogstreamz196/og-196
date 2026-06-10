import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EditableContent } from "@/components/admin/EditableContent";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  return (
    <DashboardShell title="Settings">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">
            <EditableContent contentKey="settings.account.heading" defaultValue="Account" />
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">{user?.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Display name</dt>
              <dd>{profile?.display_name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Coin balance</dt>
              <dd>{profile?.coin_balance ?? 0}</dd>
            </div>
          </dl>
        </section>
      </div>
    </DashboardShell>
  );
}
