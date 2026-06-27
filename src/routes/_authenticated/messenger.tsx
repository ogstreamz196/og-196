import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, MessageCircle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { OgChat } from "@/components/messenger/OgChat";
import { CommunityRoom } from "@/components/messenger/CommunityRoom";
import { PoweredByOgBot } from "@/components/PoweredByOgBot";
import { EarnCoinStrip } from "@/components/referrals/EarnCoinStrip";


import ogBotAsset from "@/assets/ogbot.png.asset.json";

export const Route = createFileRoute("/_authenticated/messenger")({
  component: MessengerPage,
  validateSearch: (search: Record<string, unknown>) => ({
    live: search.live === "1" || search.live === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "OG Bot · Private chat & Live Community" },
      {
        name: "description",
        content:
          "Chat privately with OG Bot or flip the switch into Live Chat Mode to join the EXCLUSIVE OG Community room.",
      },
    ],
  }),
});

function MessengerPage() {
  const { live: initialLive } = Route.useSearch();
  const [liveChat, setLiveChat] = useState<boolean>(Boolean(initialLive));

  return (
    <DashboardShell title="OG Bot">


      <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[520px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/70 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/5 backdrop-blur-xl sm:h-[calc(100dvh-10rem)] sm:rounded-3xl">

        {/* Header — adapts to current mode */}
        <header
          className={`relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 backdrop-blur-xl transition-colors sm:gap-4 sm:px-7 sm:py-5 ${
            liveChat
              ? "bg-gradient-to-r from-cyan-500/20 via-sky-500/10 to-fuchsia-500/15"
              : "bg-gradient-to-r from-primary/15 via-card/90 to-card/80"
          }`}
        >
          <div className="relative shrink-0">
            <span
              aria-hidden
              className={`absolute -inset-1.5 rounded-full blur-md ${
                liveChat
                  ? "bg-gradient-to-br from-cyan-400/40 via-fuchsia-500/30 to-transparent"
                  : "bg-gradient-to-br from-primary/40 via-fuchsia-500/30 to-transparent"
              }`}
            />
            {liveChat ? (
              <span className="relative grid h-11 w-11 place-items-center rounded-full bg-cyan-500/25 ring-2 ring-cyan-400/60 ring-offset-2 ring-offset-card sm:h-16 sm:w-16">
                <Users className="h-5 w-5 text-cyan-100 sm:h-7 sm:w-7" />
              </span>
            ) : (
              <img
                src={ogBotAsset.url}
                alt="OG Bot"
                className="relative h-11 w-11 rounded-full object-cover ring-2 ring-primary/60 ring-offset-2 ring-offset-card sm:h-16 sm:w-16"
              />
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-400 shadow-[0_0_10px_-1px_oklch(0.78_0.18_155)] sm:h-3.5 sm:w-3.5" />
          </div>

          <div className="min-w-0 space-y-0.5 sm:space-y-1">
            <div
              className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] sm:text-[10px] sm:tracking-[0.22em] ${
                liveChat
                  ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              <span className="truncate">
                {liveChat ? "Live · OG Community" : "OG Bot · Private chat"}
              </span>
            </div>
            <h1 className="truncate font-display text-lg font-black leading-tight tracking-tight sm:text-3xl">
              {liveChat ? "OG Community" : "OG Bot"}
            </h1>
            <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-emerald-400 sm:text-sm">
              <span className="relative inline-flex h-2 w-2 shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="truncate">
                {liveChat ? "Everyone talks · Bot replies" : "Online · songwriting partner"}
              </span>
            </p>
          </div>

          {/* Mode toggle — Loner ↔ Community (single button, label reflects current mode) */}
          <button
            type="button"
            onClick={() => setLiveChat((v) => !v)}
            aria-pressed={liveChat}
            aria-label={liveChat ? "Community Mode is on — tap to switch to Loner Mode" : "Loner Mode is on — tap to switch to Community Mode"}
            className={`group flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all active:scale-95 sm:text-xs ${
              liveChat
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)] hover:bg-cyan-500/25"
                : "border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_-6px_oklch(0.7_0.2_25/0.6)] hover:bg-primary/20"
            }`}
          >
            {liveChat ? (
              <Users className="h-4 w-4 text-cyan-300" />
            ) : (
              <MessageCircle className="h-4 w-4 text-primary" />
            )}
            <span className="whitespace-nowrap">
              {liveChat ? "Community Mode" : "Loner Mode"}
            </span>
          </button>

        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {liveChat ? <CommunityRoom /> : <OgChat showHeader showQuickStarts />}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3">
        <EarnCoinStrip />
        <PoweredByOgBot />
      </div>

    </DashboardShell>
  );
}
