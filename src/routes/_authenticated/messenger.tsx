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
      <div className="mx-auto flex h-[calc(100dvh-11rem)] min-h-[480px] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-card/70 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/5 backdrop-blur-xl sm:h-[calc(100dvh-12rem)]">
        {/* Premium sticky header — gradient surface, larger avatar, kicker + name + status */}
        <header className="relative flex items-center gap-4 border-b border-white/10 bg-gradient-to-r from-primary/15 via-card/90 to-card/80 px-5 py-4 backdrop-blur-xl sm:px-7 sm:py-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          />
          <div className="relative shrink-0">
            <span
              aria-hidden
              className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-primary/40 via-fuchsia-500/30 to-transparent blur-md"
            />
            <img
              src={ogBotAsset.url}
              alt="OG Bot"
              className="relative h-14 w-14 rounded-full object-cover ring-2 ring-primary/60 ring-offset-2 ring-offset-card sm:h-16 sm:w-16"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-400 shadow-[0_0_10px_-1px_oklch(0.78_0.18_155)]" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              OG Messenger
            </div>
            <h1 className="truncate font-display text-2xl font-black leading-tight tracking-tight sm:text-3xl">
              OG Bot
            </h1>
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-emerald-400">
              <span className="relative inline-flex h-2 w-2 shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Online · your songwriting partner
            </p>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <OgChat showHeader showQuickStarts />
        </div>
      </div>
    </DashboardShell>

  );
}
