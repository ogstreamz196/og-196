import { useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OgChat } from "./OgChat";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function OgBotWidget() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const qc = useQueryClient();

  // If the developer has tokens AND all of them are suspended, the widget
  // must hide immediately — same contract enforced by validate_bot_token.
  const tokensQ = useQuery({
    queryKey: ["og-widget-token-status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_tokens")
        .select("status")
        .eq("developer_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: react instantly to suspend / reactivate without polling.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`og-widget-tokens-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_tokens", filter: `developer_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["og-widget-token-status", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  // Hide widget on the dedicated messenger page (the page IS the chat).
  if (pathname === "/messenger") return null;

  // If the user has provisioned tokens but every one is suspended, hide.
  const tokens = tokensQ.data ?? [];
  if (tokens.length > 0 && tokens.every((t) => t.status !== "active")) return null;

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
