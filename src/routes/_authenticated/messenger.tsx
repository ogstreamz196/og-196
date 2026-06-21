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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header className="relative overflow-hidden rounded-3xl border-2 border-primary/40 bg-gradient-brand p-5 shadow-glow">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="wc-bounce-soft rounded-full bg-white/15 p-1 ring-2 ring-white/40">
              <img
                src={ogBotAsset.url}
                alt="OG Bot"
                className="h-14 w-14 rounded-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-white/80">
                Live · OG Bot
              </p>
              <h1 className="font-display text-3xl font-normal leading-none tracking-tight text-primary-foreground drop-shadow-[0_2px_0_rgba(0,0,0,0.25)] sm:text-4xl">
                OG Messenger
              </h1>
              <p className="mt-1 text-xs font-semibold text-white/90">
                Your songwriting partner · 1 OG coin per message
              </p>
            </div>
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white sm:inline-flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Online
            </span>
          </div>
        </header>
        <div className="h-[calc(100vh-16rem)] min-h-[480px]">
          <OgChat showHeader showQuickStarts />
        </div>
      </div>
    </DashboardShell>
  );
}
