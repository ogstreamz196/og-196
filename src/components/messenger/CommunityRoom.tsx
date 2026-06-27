import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, Send, Users, Loader2, Trash2 } from "lucide-react";
import { TypingDots } from "@/components/ui/typing-dots";
import { toast } from "sonner";
import {
  listCommunityMessages,
  listOlderCommunityMessages,
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

const TYPING_TTL_MS = 4000;

export function CommunityRoom() {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const qc = useQueryClient();
  const listFn = useServerFn(listCommunityMessages);
  const olderFn = useServerFn(listOlderCommunityMessages);
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
  const messages: CommunityMessage[] = useMemo(() => data?.messages ?? [], [data?.messages]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; at: number }>>({});
  const [showJump, setShowJump] = useState(false);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const stickToBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);

  // Realtime: new messages (dedup by id)
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

  // Realtime: typing indicator via broadcast
  useEffect(() => {
    if (!myId) return;
    const channel = supabase.channel("community-typing", {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      const { userId, name } = (payload ?? {}) as { userId?: string; name?: string };
      if (!userId || userId === myId) return;
      setTypingUsers((prev) => ({
        ...prev,
        [userId]: { name: name || "Someone", at: Date.now() },
      }));
    });
    channel.subscribe();
    typingChannelRef.current = channel;
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.at < TYPING_TTL_MS) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [myId]);

  const broadcastTyping = useCallback(() => {
    if (!myId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    const ch = typingChannelRef.current;
    if (!ch) return;
    ch.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: myId,
        name: user?.user_metadata?.display_name || user?.email?.split("@")[0] || "OG member",
      },
    });
  }, [myId, user]);

  // Virtualizer — windows the message list so very long histories stay smooth.
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (i) => messages[i]?.id ?? i,
  });

  // Initial scroll to bottom once the first page has rendered.
  useLayoutEffect(() => {
    if (didInitialScrollRef.current || messages.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    rowVirtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    el.scrollTop = el.scrollHeight;
    didInitialScrollRef.current = true;
  }, [messages.length, rowVirtualizer]);

  // Auto-scroll to newest only if user is already near the bottom.
  useEffect(() => {
    if (!didInitialScrollRef.current) return;
    if (!stickToBottomRef.current || messages.length === 0) return;
    rowVirtualizer.scrollToIndex(messages.length - 1, { align: "end" });
  }, [messages.length, rowVirtualizer]);

  // Scroll handler: track near-bottom + trigger cursor pagination on top.
  const onScroll = useCallback(async () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    stickToBottomRef.current = nearBottom;
    setShowJump(!nearBottom && messages.length > 0);

    if (el.scrollTop > 40 || loadingOlder || !hasMore || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;
    try {
      const res = await olderFn({
        data: { before: oldest.created_at, beforeId: oldest.id, limit: 50 },
      });
      if (res.messages.length === 0) {
        setHasMore(false);
      } else {
        setHasMore(res.hasMore);
        qc.setQueryData<{ messages: CommunityMessage[] } | undefined>(
          ["community-messages"],
          (prev) => {
            const existing = prev?.messages ?? [];
            const seen = new Set(existing.map((m) => m.id));
            const merged = [...res.messages.filter((m) => !seen.has(m.id)), ...existing];
            return { messages: merged };
          },
        );
        // Preserve scroll position after prepending older messages.
        requestAnimationFrame(() => {
          const node = scrollRef.current;
          if (node) node.scrollTop = node.scrollHeight - prevHeight + prevTop;
        });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder, messages, olderFn, qc]);

  const jumpToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    setShowJump(false);
    if (messages.length > 0) {
      rowVirtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages.length, rowVirtualizer]);

  const send = useMutation({
    mutationFn: (content: string) => postFn({ data: { content, foulMouth } }),
    onSuccess: () => {
      setText("");
      stickToBottomRef.current = true;
    },
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

  const activeTypers = Object.values(typingUsers);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2 p-2 sm:p-3">
      {canClear && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 sm:px-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-destructive/80">
            Dev controls
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={clear.isPending}
            onClick={() => {
              if (window.confirm("Wipe ALL live community messages? This cannot be undone.")) {
                clear.mutate();
              }
            }}
          >
            {clear.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Clear live chat
          </Button>
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="absolute inset-0 overflow-y-auto overscroll-contain rounded-2xl border border-border/40 bg-background/40 p-2 backdrop-blur-md sm:p-3"
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
            <>
              {loadingOlder && (
                <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading older messages…
                </div>
              )}
              {!hasMore && (
                <div className="py-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  Beginning of chat
                </div>
              )}
              <div
                style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}
              >
                {rowVirtualizer.getVirtualItems().map((vi) => {
                  const m = messages[vi.index];
                  if (!m) return null;
                  const mine = m.role === "user" && m.user_id === myId;
                  const isBot = m.role === "bot";
                  return (
                    <div
                      key={vi.key}
                      ref={rowVirtualizer.measureElement}
                      data-index={vi.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${vi.start}px)`,
                      }}
                    >
                      <div
                        className={`flex items-end gap-2 py-1.5 ${mine ? "flex-row-reverse" : "flex-row"}`}
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
                          className={`min-w-0 max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[78%] ${
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
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        {showJump && (
          <Button
            type="button"
            size="sm"
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 gap-1.5 rounded-full shadow-lg"
          >
            <ArrowDown className="h-3.5 w-3.5" /> Jump to newest
          </Button>
        )}
      </div>

      {activeTypers.length > 0 && (
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <TypingDots size="sm" aria-label="People typing" />
          <span className="truncate">
            {activeTypers.length === 1
              ? `${activeTypers[0].name} is typing…`
              : activeTypers.length === 2
                ? `${activeTypers[0].name} and ${activeTypers[1].name} are typing…`
                : `${activeTypers.length} people are typing…`}
          </span>
        </div>
      )}

      <form
        onSubmit={submit}
        className="sticky bottom-0 flex items-end gap-2 rounded-2xl border border-border/40 bg-background/80 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md"
      >
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            broadcastTyping();
          }}
          onKeyDown={(e) => {
            // On desktop: Enter sends, Shift+Enter newline.
            // On mobile (touch): Enter always inserts newline; tap Send to submit.
            const isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
            if (e.key === "Enter" && !e.shiftKey && !isTouch) {
              e.preventDefault();
              submit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Say something to the OG Community…"
          rows={1}
          maxLength={1000}
          enterKeyHint="send"
          className="min-h-[44px] max-h-32 resize-none border-0 bg-transparent text-base focus-visible:ring-0 sm:text-sm"
          disabled={send.isPending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || send.isPending}
          className="h-11 w-11 shrink-0 rounded-xl"
          aria-label="Send message"
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
