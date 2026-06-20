import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { OgChat } from "@/components/messenger/OgChat";
import ogBotAsset from "@/assets/ogbot.png.asset.json";

export const Route = createFileRoute("/_authenticated/messenger")({
  component: MessengerPage,
  head: () => ({
    meta: [
      { title: "OG Messenger · Your songwriting partner" },
      {
        name: "description",
        content:
          "Chat with OG Bot — your in-house songwriting partner for personalised tracks, Suno prompts, lyrics, and more.",
      },
    ],
  }),
});

function MessengerPage() {
  return (
    <DashboardShell title="OG Messenger">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header className="flex items-center gap-3">
          <img
            src={ogBotAsset.url}
            alt="OG Bot"
            className="h-12 w-12 rounded-full object-cover drop-shadow-[0_0_18px_hsl(var(--primary)/0.6)]"
          />
          <div>
            <h1 className="text-xl font-black tracking-tight">OG Bot</h1>
            <p className="text-xs text-muted-foreground">
              Your songwriting partner · 1 OG coin per message
            </p>
          </div>
        </header>
        <div className="h-[calc(100vh-14rem)] min-h-[480px]">
          <OgChat showHeader showQuickStarts />
        </div>
      </div>
    </DashboardShell>
  );
}
