import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, MessageCircle, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { OgChat } from "@/components/messenger/OgChat";
import { CommunityRoom } from "@/components/messenger/CommunityRoom";

import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useMessengerMode,
  useSetMessengerMode,
  type MessengerMode,
} from "@/hooks/use-messenger-mode";
import { useFoulMouth } from "@/hooks/use-foul-mouth";

import ogBotAsset from "@/assets/ogbot.png.asset.json";

export const Route = createFileRoute("/_authenticated/messenger")({
  component: MessengerPage,
  validateSearch: (search: Record<string, unknown>) => ({
    live: search.live === "1" || search.live === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "OG Bot · Loner Mode & OG Community Mode" },
      {
        name: "description",
        content:
          "Chat privately in OG Bot Loner Mode, or switch to OG Community Mode to join the public OG Community room.",
      },
    ],
  }),
});

function MessengerPage() {
  const { live: initialLive } = Route.useSearch();
  const { mode, isReady } = useMessengerMode();
  const setMode = useSetMessengerMode();
  const { foulMouth } = useFoulMouth();

  // One-time bootstrap: ?live=1 deep-link wins over saved pref on first load.
  useEffect(() => {
    if (!isReady) return;
    if (initialLive && mode !== "community") {
      setMode.mutate("community");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  const isCommunity = mode === "community";
  const [pendingMode, setPendingMode] = useState<MessengerMode | null>(null);

  function requestSwitch() {
    setMode.mutate(isCommunity ? "loner" : "community");
  }

  function confirmSwitch() {
    if (pendingMode) setMode.mutate(pendingMode);
    setPendingMode(null);
  }

  return (
    <DashboardShell title={isCommunity ? "OG Community Mode" : "OG Bot Loner Mode"}>
      <div className={`relative -mx-4 -my-5 sm:-mx-6 sm:-my-8 lg:-mx-8 lg:-my-10 ${foulMouth ? "hell-aura" : ""}`}>
        {foulMouth && (
          <>
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.35),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(220,38,38,0.3),transparent_65%)] animate-pulse" />
          </>
        )}
      <div className={`flex h-[calc(100dvh-var(--app-header-h,4rem))] min-h-[520px] w-full flex-col overflow-hidden border-0 ${foulMouth ? "bg-gradient-to-b from-[#1a0505]/95 via-[#220808]/90 to-[#0d0202]/95" : "bg-card/60"}`}>

        {/* Header — adapts to current mode */}
        <header
          className={`relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 backdrop-blur-xl transition-colors sm:gap-4 sm:px-7 sm:py-5 ${
            isCommunity
              ? "bg-gradient-to-r from-cyan-500/20 via-sky-500/10 to-fuchsia-500/15"
              : "bg-gradient-to-r from-primary/15 via-card/90 to-card/80"
          }`}
        >
          <div className="relative shrink-0">
            <span
              aria-hidden
              className={`absolute -inset-1.5 rounded-full blur-md ${
                isCommunity
                  ? "bg-gradient-to-br from-cyan-400/40 via-fuchsia-500/30 to-transparent"
                  : "bg-gradient-to-br from-primary/40 via-fuchsia-500/30 to-transparent"
              }`}
            />
            {isCommunity ? (
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
                isCommunity
                  ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                  : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              <span className="truncate">
                {isCommunity ? "OG Community Mode · public room" : "OG Bot Loner Mode · private"}
              </span>
            </div>
            <h1 className="truncate font-display text-lg font-black leading-tight tracking-tight sm:text-3xl">
              {isCommunity ? "OG Community Mode" : "OG Bot Loner Mode"}
            </h1>

            <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-emerald-400 sm:text-sm">
              <span className="relative inline-flex h-2 w-2 shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="truncate">
                {isCommunity
                  ? "Everyone can see your messages here"
                  : "Just you & OG Bot · nobody else sees this"}
              </span>
            </p>
          </div>

          {/* Mode toggle — Loner ↔ Community. Switch label states what tapping will DO. */}
          <button
            type="button"
            onClick={requestSwitch}
            disabled={setMode.isPending || !isReady}
            role="switch"
            aria-checked={isCommunity}
            aria-label={
              isCommunity
                ? "Start Private Mode (leave OG Community)"
                : "Leave Private Mode (switch to OG Community Mode)"
            }
            className={`group flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:text-xs ${
              isCommunity
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)] hover:bg-cyan-500/25"
                : "border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_-6px_oklch(0.7_0.2_25/0.6)] hover:bg-primary/20"
            }`}
          >
            {isCommunity ? (
              <Users className="h-4 w-4 text-cyan-300" />
            ) : (
              <MessageCircle className="h-4 w-4 text-primary" />
            )}
            <span className="whitespace-pre-line text-center leading-tight">{setMode.isPending ? "Saving…" : isCommunity ? "Start Private Mode" : "TURN ON\n GLOBAL MODE"}</span>

          </button>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {!isReady ? (
            <div
              role="status"
              aria-live="polite"
              aria-label="Loading your messenger preferences"
              className="flex h-full flex-col gap-3 p-4 sm:p-6"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading your messenger…
              </div>
              <Skeleton className="h-16 w-3/4 rounded-2xl" />
              <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
              <Skeleton className="h-20 w-5/6 rounded-2xl" />
              <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
              <div className="mt-auto">
                <Skeleton className="h-12 w-full rounded-full" />
              </div>
            </div>
          ) : isCommunity ? (
            <CommunityRoom />
          ) : (
            <OgChat showHeader showQuickStarts />
          )}
          {setMode.isPending && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
            >
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-card/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground shadow-lg backdrop-blur">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving mode…
              </span>
            </div>
          )}
        </div>
      </div>
      </div>


      <AlertDialog open={pendingMode !== null} onOpenChange={(o) => !o && setPendingMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingMode === "community"
                ? "Switch to OG Community Mode?"
                : "Switch to OG Bot Loner Mode?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMode === "community"
                ? "You'll leave your private chat with OG Bot and join the public OG Community room. Anything you send here is visible to everyone in the room."
                : "You'll leave the public OG Community room and return to a private 1-on-1 chat with OG Bot. Only you can see Loner Mode messages."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay here</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitch}>
              {pendingMode === "community" ? "Yes, go to Community" : "Yes, back to Loner"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
