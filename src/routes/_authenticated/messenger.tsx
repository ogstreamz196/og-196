import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { OgChat } from "@/components/messenger/OgChat";

export const Route = createFileRoute("/_authenticated/messenger")({
  component: MessengerPage,
});

function MessengerPage() {
  return (
    <DashboardShell title="OG Messenger">
      <div className="mx-auto h-[calc(100vh-12rem)] max-w-3xl">
        <OgChat />
      </div>
    </DashboardShell>
  );
}
