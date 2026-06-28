import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Share2, Sparkles, Copy, Check } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Compact, share-first reminder: shows the user's OG referral code and the
 * 10% commission promise. Drop it anywhere coins are being spent or bought
 * so the cashback loop stays top-of-mind.
 */
export function ReferralReminder({ className }: { className?: string }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: code } = useQuery({
    queryKey: ["my-referral-code", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user!.id)
        .maybeSingle();
      return (data?.referral_code as string | null) ?? null;
    },
  });

  if (!code) return null;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${code.replace(/^OG-/, "")}`
      : `/r/${code.replace(/^OG-/, "")}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied — share it to earn 10% cashback");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy");
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && (navigator as Navigator).share) {
      try {
        await (navigator as Navigator).share({
          title: "Join me on OG",
          text: `Use my OG code ${code} — we both win.`,
          url: shareUrl,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    copy();
  }

  return (
    <div
      data-testid="referral-reminder"
      className={cn(
        // Consistent responsive padding via clamp keeps spacing identical
        // looking across phone → tablet → desktop.
        "relative overflow-hidden rounded-2xl border border-coin/40 bg-gradient-to-r from-coin/10 via-coin/5 to-transparent shadow-card",
        "[padding:clamp(0.875rem,2.5vw,1.25rem)]",
        className,
      )}
    >
      {/* Mobile: stacked. sm+: row with auto-sized action cluster.
          grid-cols-[minmax(0,1fr)_auto] guarantees the text column can shrink
          and the buttons never get clipped. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coin/20 text-coin">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-coin">
              Earn 10% cashback
            </div>
            <p
              className="text-foreground [overflow-wrap:anywhere]"
              style={{ fontSize: "clamp(0.8125rem, 2.6vw, 0.9375rem)", lineHeight: 1.35 }}
            >
              Share your code and bank 10% of every coin they burn — forever.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2">
              <code
                aria-label={`Your referral code ${code}`}
                className="max-w-full truncate rounded-md bg-background/60 px-2 py-1 font-mono text-xs font-bold tracking-wider text-foreground ring-1 ring-coin/30"
              >
                {code}
              </code>
              <button
                type="button"
                onClick={copy}
                aria-label={copied ? "Referral link copied" : "Copy referral link"}
                aria-live="polite"
                className="inline-flex min-h-11 min-w-11 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-semibold text-foreground/85 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coin/60 sm:min-h-9 sm:min-w-0 sm:text-[11px]"
              >
                {copied ? <Check className="h-4 w-4 sm:h-3 sm:w-3" aria-hidden /> : <Copy className="h-4 w-4 sm:h-3 sm:w-3" aria-hidden />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
        {/* Action cluster: full width on mobile so buttons are tappable;
            auto width on sm+ so it never crowds the text. */}
        <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={share}
            aria-label="Share your referral link"
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-coin px-4 text-sm font-bold text-background shadow hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coin/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-9 sm:flex-none sm:px-3 sm:text-xs"
          >
            <Share2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden /> Share
          </button>
          <Link
            to="/referrals"
            aria-label="See referral earnings details"
            className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-semibold text-foreground/85 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coin/60 sm:h-9 sm:min-w-0 sm:px-2 sm:text-[11px]"
          >
            Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
