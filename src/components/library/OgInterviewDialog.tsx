import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircleHeart, Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { invokeError } from "@/lib/invoke-error";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type InterviewTurn = { role: "bot" | "user"; text: string };

interface OgInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed: string;
  onDone: (brief: string, transcript: InterviewTurn[]) => void;
}

const DRAFT_KEY = "og-interview:draft:v1";
const DRAFT_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const TARGET_ANSWERS = 4;

type Draft = { seed: string; history: InterviewTurn[]; answer: string; ts: number };

function loadDraft(seed: string): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (!parsed || parsed.seed !== seed) return null;
    if (Date.now() - parsed.ts > DRAFT_TTL_MS) return null;
    if (!Array.isArray(parsed.history)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(draft: Draft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function OgInterviewDialog({ open, onOpenChange, seed, onDone }: OgInterviewDialogProps) {
  const [history, setHistory] = useState<InterviewTurn[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore draft (or start fresh) whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    const draft = loadDraft(seed);
    if (draft && draft.history.length > 0) {
      setHistory(draft.history);
      setAnswer(draft.answer ?? "");
      // If last turn is from user, the bot owes us a question — fetch it.
      const last = draft.history[draft.history.length - 1];
      if (last?.role === "user") {
        void askNext(draft.history);
      }
    } else {
      setHistory([]);
      setAnswer("");
      void askNext([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);

  // Persist transcript + in-flight answer whenever they change while open.
  useEffect(() => {
    if (!open) return;
    if (history.length === 0 && !answer) return;
    saveDraft({ seed, history, answer, ts: Date.now() });
  }, [open, seed, history, answer]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (open && !loading && !finishing) {
      inputRef.current?.focus();
    }
  }, [history, loading, finishing, open]);


  async function askNext(currentHistory: InterviewTurn[]) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("og-interview", {
        body: { action: "next", seed, history: currentHistory },
      });
      if (error) throw new Error(invokeError(error, "Bot couldn't think of a question"));
      const q = (data?.question ?? "").toString().trim();
      if (!q) throw new Error("Bot went quiet — try again");
      setHistory([...currentHistory, { role: "bot", text: q }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Interview failed");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    const text = answer.trim();
    if (!text || loading || finishing) return;
    const next: InterviewTurn[] = [...history, { role: "user", text }];
    setHistory(next);
    setAnswer("");
    await askNext(next);
  }

  async function finish() {
    if (finishing || loading) return;
    const answered = history.filter((t) => t.role === "user").length;
    if (answered === 0) {
      clearDraft();
      onOpenChange(false);
      return;
    }
    setFinishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("og-interview", {
        body: { action: "summarize", seed, history },
      });
      if (error) throw new Error(invokeError(error, "Couldn't save your details"));
      const summary = (data?.summary ?? "").toString().trim();
      if (!summary) throw new Error("Bot returned nothing — try again");
      onDone(summary, history);
      toast.success(`Saved ${answered} answer${answered === 1 ? "" : "s"} into your details`);
      clearDraft();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't finish interview");

    } finally {
      setFinishing(false);
    }
  }

  const answered = history.filter((t) => t.role === "user").length;

  return (
    <Dialog open={open} onOpenChange={(o) => !finishing && onOpenChange(o)}>
      <DialogContent className="flex max-h-[92svh] w-[min(96vw,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[88svh]">
        <DialogHeader className="space-y-1 border-b border-white/10 bg-gradient-to-br from-primary/20 via-fuchsia-500/10 to-background px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <MessageCircleHeart className="h-5 w-5 text-primary" />
            OG Bot wants to know you
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Answer as many as you like. Every answer makes the song sharper.
            Tap <span className="font-semibold text-foreground">That's enough</span> when you're done.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Interview conversation"
          className="flex-1 space-y-3 overflow-y-auto bg-background/40 px-4 py-4 sm:px-5"
        >
          {history.length === 0 && loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              OG Bot is thinking of the first question…
            </div>
          )}

          {history.map((turn, i) => (
            <div
              key={i}
              className={cn(
                "flex w-full",
                turn.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                  turn.role === "bot"
                    ? "rounded-tl-md border border-primary/30 bg-primary/10 text-foreground"
                    : "rounded-tr-md bg-primary text-primary-foreground",
                )}
              >
                {turn.role === "bot" && (
                  <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-primary/80">
                    OG Bot
                  </div>
                )}
                <div className="whitespace-pre-wrap">{turn.text}</div>
              </div>
            </div>
          ))}

          {loading && history.length > 0 && (
            <div className="flex items-center gap-2 pl-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              OG Bot is cooking the next one…
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-white/10 bg-card/80 px-4 py-3 sm:px-5">
          <Textarea
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value.slice(0, 600))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void submit();
              } else if (e.key === "Escape" && !finishing) {
                e.preventDefault();
                void finish();
              }
            }}
            aria-label="Your answer"
            placeholder={
              loading
                ? "Waiting for the next question…"
                : "Your answer — Enter to send, Shift+Enter for new line, Esc to finish"
            }
            disabled={loading || finishing}
            rows={2}
            className="resize-none rounded-xl border-primary/20 bg-background/60 text-sm focus-visible:ring-2 focus-visible:ring-primary"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {answered === 0 ? (
                <>Tip: short, specific answers work best.</>
              ) : (
                <>
                  <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
                  {answered} answer{answered === 1 ? "" : "s"} captured
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={finish}
                disabled={finishing}
                className="gap-1.5 text-xs font-semibold"
              >
                {finishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                That's enough
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={submit}
                disabled={loading || finishing || !answer.trim()}
                className="gap-1.5 bg-gradient-brand text-primary-foreground"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
