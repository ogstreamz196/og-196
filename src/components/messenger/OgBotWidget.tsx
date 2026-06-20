import { useState } from "react";
import { Bot, X } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { OgChat } from "./OgChat";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Floating OG Bot widget. Clean & minimal:
 *  - Same backend + same memory as the /messenger page.
 *  - Single header control: a foul-mouth toggle shown as 🖕 when ON,
 *    or "Safe" when OFF. Tap to flip modes site-wide.
 *  - Hidden on the dedicated messenger page (avoids stacking two chats).
 *  - Hidden when no user is signed in.
 */
export function OgBotWidget() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { foulMouth } = useFoulMouth();
  const setFoulMouth = useSetFoulMouth();

  if (!user) return null;
  if (pathname === "/messenger") return null;

  async function toggleFoul(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const next = !foulMouth;
      await setFoulMouth.mutateAsync(next);
      toast.message(next ? "🖕 Foul mouth: ON" : "🛡️ Safe mode: ON");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="h-[480px] w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/20">
          <div className="flex items-center justify-between border-b border-border bg-gradient-brand px-4 py-2.5 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="text-sm font-semibold">OG Bot</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleFoul}
                disabled={setFoulMouth.isPending}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-bold transition-colors",
                  foulMouth
                    ? "bg-white/20 hover:bg-white/30"
                    : "bg-white/10 hover:bg-white/20",
                )}
                title={foulMouth ? "Foul mouth ON — tap for Safe" : "Safe mode — tap for 🖕"}
                aria-label={foulMouth ? "Switch to safe mode" : "Switch to foul mouth"}
              >
                {foulMouth ? <span className="text-base leading-none">🖕</span> : "Safe"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 transition-colors hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="h-[calc(480px-44px)]">
            <OgChat compact />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-14 w-14 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-glow transition-transform hover:scale-105"
        aria-label={open ? "Close OG Bot" : "Open OG Bot"}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </div>
  );
}
