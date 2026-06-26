import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Send, Users, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listCommunityMessages,
  postCommunityMessage,
  clearCommunityMessages,
  type CommunityMessage,
} from "@/lib/community.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useFoulMouth } from "@/hooks/use-foul-mouth";
import { useRole } from "@/hooks/use-role";
import ogBotAsset from "@/assets/ogbot.png.asset.json";

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Shared OG Community room — embedded inside the Messenger page when
 * "Live Chat Mode" is enabled.
 */
export function CommunityRoom() {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const qc = useQueryClient();
  const listFn = useServerFn(listCommunityMessages);
  const postFn = useServerFn(postCommunityMessage);
  const clearFn = useServerFn(clearCommunityMessages);
  const { foulMouth } = useFoulMouth();
  const { isDev, isAdmin } = useRole();
  const canClear = isDev || isAdmin;

  const { data, isLoading } = useQuery({
    queryKey: ["community-messages"],
    queryFn: () => listFn(),
    staleTime: 10_000,
  });
  const messages: CommunityMessage[] = data?.messages ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const channel = supabase
      .channel("community-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        (payload) => {
          const row = payload.new as CommunityMessage;
          qc.setQueryData<{ messages: CommunityMessage[] } | undefined>(
            ["community-messages"],
            (prev) => {
              const existing = prev?.messages ?? [];
              if (existing.some((m) => m.id === row.id)) return prev;
              return { messages: [...existing, row] };
            },
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = useMutation({
    mutationFn: (content: string) => postFn({ data: { content, foulMouth } }),
    onSuccess: () => setText(""),
    onError: (err: Error) => toast.error(err.message),
  });

  const clear = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => {
      qc.setQueryData(["community-messages"], { messages: [] });
      toast.success("Live chat cleared");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || send.isPending) return;
    send.mutate(t);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2 p-3">
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border/40 bg-background/40 p-3 backdrop-blur-md"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading community…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Users className="h-8 w-8 opacity-50" />
            <p className="text-sm">Be the first to say something.</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.role === "user" && m.user_id === myId;
            const isBot = m.role === "bot";
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-[10px] font-bold uppercase ${
                    isBot
                      ? "bg-primary/20 ring-1 ring-primary/40"
                      : mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                  }`}
                >
                  {isBot ? (
                    <img src={ogBotAsset.url} alt="OG Bot" className="h-full w-full object-cover" />
                  ) : (
                    initials(m.display_name)
                  )}
                </span>
                <div
                  className={`min-w-0 max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    isBot
                      ? "border border-primary/30 bg-primary/10 text-foreground"
                      : mine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                  }`}
                >
                  <p
                    className={`mb-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      mine ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    {isBot ? "OG Bot" : m.display_name || "OG member"} · {formatTime(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap break-words leading-snug">{m.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={submit}
        className="flex items-end gap-2 rounded-2xl border border-border/40 bg-background/60 p-2 backdrop-blur-md"
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Say something to the OG Community…"
          rows={1}
          maxLength={1000}
          className="min-h-[44px] max-h-32 resize-none border-0 bg-transparent text-sm focus-visible:ring-0"
          disabled={send.isPending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || send.isPending}
          className="h-11 w-11 shrink-0 rounded-xl"
        >
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      <p className="px-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
        Free to chat · OG Bot keeps replies short
      </p>
    </div>
  );
}
