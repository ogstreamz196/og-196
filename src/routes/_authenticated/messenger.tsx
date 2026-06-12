import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import ogLogo from "@/assets/og-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/messenger")({
  component: MessengerPage,
});

function MessengerPage() {
  return (
    <DashboardShell title="OG Messenger">
      <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-3xl flex-col items-center justify-center gap-6 text-center">
        <img
          src={ogLogo.url}
          alt="OG Bot"
          className="h-auto w-full max-w-md drop-shadow-[0_0_40px_rgba(var(--primary-rgb,99_102_241)/0.35)]"
        />
        <p className="text-sm text-muted-foreground">
          Tap the OG Bot button in the corner to start chatting.
        </p>
      </div>
    </DashboardShell>
  );
}
