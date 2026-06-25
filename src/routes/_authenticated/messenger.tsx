import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Users, MessageCircle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { OgChat } from "@/components/messenger/OgChat";
import { CommunityRoom } from "@/components/messenger/CommunityRoom";
import { FoulMouthReminder } from "@/components/FoulMouthReminder";
import { PoweredByOgBot } from "@/components/PoweredByOgBot";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";
import { useRole } from "@/hooks/use-role";
import ogBotAsset from "@/assets/ogbot.png.asset.json";

export const Route = createFileRoute("/_authenticated/messenger")({
  component: MessengerPage,
  validateSearch: (search: Record<string, unknown>) => ({
    live: search.live === "1" || search.live === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "OG Messenger · Private chat & Live Community" },
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
  const { foulMouth } = useFoulMouth();
  const setFoulMouth = useSetFoulMouth();
  const { isVip } = useRole();

  async function handleFoulToggle() {
    if (!isVip) {
      toast.message("Foul-mouth is a VIP perk — grab OG VIP for £5/month.", {
        action: { label: "Get VIP", onClick: () => { window.location.href = "/buy-coins?flow=vip"; } },
      });
      return;
    }
    try {
      await setFoulMouth.mutateAsync(!foulMouth);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <DashboardShell title="OG Messenger">
      <div className="mx-auto mb-3 w-full max-w-5xl">
        <FoulMouthReminder enabled={foulMouth} onAction={handleFoulToggle} />
      </div>

      <div className="mx-auto flex h-[calc(100dvh-15rem)] min-h-[460px] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-card/70 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/5 backdrop-blur-xl sm:h-[calc(100dvh-16rem)]">
        {/* Header — adapts to current mode */}
        <header
          className={`relative flex items-center gap-4 border-b border-white/10 px-5 py-4 backdrop-blur-xl transition-colors sm:px-7 sm:py-5 ${
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
              <span className="relative grid h-14 w-14 place-items-center rounded-full bg-cyan-500/25 ring-2 ring-cyan-400/60 ring-offset-2 ring-offset-card sm:h-16 sm:w-16">
                <Users className="h-6 w-6 text-cyan-100 sm:h-7 sm:w-7" />
              </span>
            ) : (
              <img
                src={ogBotAsset.url}
                alt="OG Bot"
                className="relative h-14 w-14 rounded-full object-cover ring-2 ring-primary/60 ring-offset-2 ring-offset-card sm:h-16 sm:w-16"
              />
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-400 shadow-[0_0_10px_-1px_oklch(0.78_0.18_155)]" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] ${
                liveChat
                  ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              {liveChat ? "Live · EXCLUSIVE OG Community" : "OG Messenger · Powered by OG Bot"}
            </div>
            <h1 className="truncate font-display text-2xl font-black leading-tight tracking-tight sm:text-3xl">
              {liveChat ? "OG Community" : "OG Bot"}
            </h1>
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-emerald-400">
              <span className="relative inline-flex h-2 w-2 shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {liveChat ? "Everyone talks · OG Bot listens & replies" : "Online · your songwriting partner"}
            </p>
          </div>

          {/* Live Chat Mode toggle */}
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-background/40 px-3 py-2">
            {liveChat ? (
              <Users className="h-4 w-4 text-cyan-300" />
            ) : (
              <MessageCircle className="h-4 w-4 text-primary" />
            )}
            <Label htmlFor="live-chat-mode" className="hidden text-xs font-bold uppercase tracking-wider sm:inline">
              Live Chat
            </Label>
            <Switch
              id="live-chat-mode"
              checked={liveChat}
              onCheckedChange={setLiveChat}
              aria-label="Toggle Live Chat Mode"
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {liveChat ? <CommunityRoom /> : <OgChat showHeader showQuickStarts />}
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <PoweredByOgBot />
      </div>
    </DashboardShell>
  );
}
