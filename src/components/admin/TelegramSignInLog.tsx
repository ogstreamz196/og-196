import { useQuery } from "@tanstack/react-query";
import { Send, Crown, Link2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";

type Row = {
  id: string;
  chat_id: number | null;
  telegram_username: string | null;
  telegram_first_name: string | null;
  event_kind: string;
  source: string | null;
  created_at: string;
};

function kindBadge(kind: string) {
  const map: Record<string, { label: string; cls: string; icon: typeof Link2 }> = {
    link: { label: "Linked", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: Link2 },
    boss_link: { label: "Boss linked", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: Crown },
  };
  const entry = map[kind] ?? { label: kind, cls: "bg-muted text-foreground/80 border-border", icon: Send };
  const Icon = entry.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${entry.cls}`}>
      <Icon className="h-3 w-3" /> {entry.label}
    </span>
  );
}

export function TelegramSignInLog({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["telegram-sign-in-events", userId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("telegram_sign_in_events")
        .select("id, chat_id, telegram_username, telegram_first_name, event_kind, source, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = q.data ?? [];

  return (
    <CollapsiblePanel
      icon={<Send className="h-4 w-4 text-sky-400" />}
      title={
        <span className="inline-flex items-center gap-2">
          Telegram sign-in history
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {rows.length}
          </span>
        </span>
      }
    >
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Telegram sign-ins yet for this user.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {kindBadge(r.event_kind)}
                <span className="truncate text-sm">
                  {r.telegram_first_name ?? "—"}
                  {r.telegram_username ? (
                    <span className="ml-1 text-muted-foreground">@{r.telegram_username}</span>
                  ) : null}
                </span>
                {r.chat_id ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    chat {r.chat_id}
                  </span>
                ) : null}
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(r.created_at).toLocaleString()}
                {r.source ? <span className="ml-1 opacity-60">· {r.source}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CollapsiblePanel>
  );
}
