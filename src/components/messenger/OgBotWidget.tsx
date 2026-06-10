import { useState } from "react";
import { Bot, X } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { OgChat } from "./OgChat";
import { cn } from "@/lib/utils";

export function OgBotWidget() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Hide widget on the dedicated messenger page (the page IS the chat).
  if (pathname === "/messenger") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="h-[480px] w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/20">
          <div className="flex items-center justify-between border-b border-border bg-gradient-brand px-4 py-2.5 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="text-sm font-semibold">OG Messenger</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 transition-colors hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-[calc(480px-44px)]">
            <OgChat compact />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "grid h-14 w-14 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-glow transition-transform hover:scale-105",
        )}
        aria-label="Open OG Messenger"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </div>
  );
}
