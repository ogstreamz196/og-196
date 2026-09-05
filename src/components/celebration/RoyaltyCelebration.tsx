import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PartyPopper, Coins } from "lucide-react";

type Notice = {
  id: string;
  title: string;
  body: string | null;
  metadata: { coins?: number } | null;
};

const CONFETTI_COLORS = ["#ff2d2d", "#ffd166", "#06d6a0", "#4cc9f0", "#f72585", "#ffffff"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.4 + Math.random() * 2,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
      })),
    []
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="royalty-confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Listens (realtime) for creator notifications — e.g. someone downloaded their
 * track and they earned loyalty OG coins — and pops a victory celebration.
 */
export function RoyaltyCelebration({ userId }: { userId: string }) {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`royalty-notify:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Notice & { kind: string };
          if (row.kind === "track_download") setNotice(row);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const close = useCallback(() => {
    if (notice) {
      supabase
        .from("user_notifications" as never)
        .update({ read: true } as never)
        .eq("id", notice.id)
        .then(() => undefined);
    }
    setNotice(null);
  }, [notice]);

  return (
    <Dialog open={!!notice} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm overflow-hidden border-primary/50 bg-card text-center shadow-[0_0_80px_-12px_oklch(0.7_0.22_25/0.7)]">
        <Confetti />
        <DialogHeader className="relative items-center !text-center">
          <span className="mb-1 grid h-16 w-16 animate-bounce place-items-center rounded-full bg-primary/15 ring-2 ring-primary/60">
            <PartyPopper className="h-8 w-8 text-primary" />
          </span>
          <DialogTitle className="text-balance text-2xl font-black uppercase tracking-wide text-primary drop-shadow-[0_0_18px_oklch(0.7_0.22_25/0.8)]">
            {notice?.title ?? "Victory!"}
          </DialogTitle>
          <DialogDescription className="text-pretty text-sm leading-relaxed">
            {notice?.body}
          </DialogDescription>
        </DialogHeader>
        {typeof notice?.metadata?.coins === "number" && (
          <div className="relative mx-auto flex w-fit items-center gap-2 rounded-full border border-amber-300/50 bg-amber-400/10 px-4 py-2 text-sm font-black uppercase tracking-widest text-amber-200">
            <Coins className="h-4 w-4" />+{notice.metadata.coins} loyalty OG coin
          </div>
        )}
        <button
          type="button"
          onClick={close}
          className="relative mx-auto mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-black uppercase tracking-widest text-primary-foreground transition-transform hover:scale-105 active:scale-95"
        >
          Let&apos;s go!
        </button>
      </DialogContent>
    </Dialog>
  );
}
