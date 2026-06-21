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
      {/* Full-bleed chat surface that fills the viewport under the dashboard chrome */}
      <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        {/* Compact sticky header (Telegram-style: avatar + name + status) */}
        <header className="flex items-center gap-3 border-b border-border/70 bg-card/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="relative shrink-0">
            <img
              src={ogBotAsset.url}
              alt="OG Bot"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/40"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight">OG Bot</h1>
            <p className="truncate text-[11px] font-medium text-emerald-500">online · songwriting partner</p>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <OgChat showHeader showQuickStarts />
        </div>
      </div>
    </DashboardShell>
  );
}
