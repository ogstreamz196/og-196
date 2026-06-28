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
      className={cn(
        "relative overflow-hidden rounded-2xl border border-coin/40 bg-gradient-to-r from-coin/10 via-coin/5 to-transparent p-4 shadow-card",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coin/20 text-coin">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-coin">
              Earn 10% cashback
            </div>
            <p className="text-sm leading-snug text-foreground [overflow-wrap:anywhere]">
              Share your code and bank 10% of every coin they burn — forever.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <code className="rounded-md bg-background/60 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-foreground ring-1 ring-coin/30">
                {code}
              </code>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={share}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-coin px-3 text-xs font-bold text-background shadow hover:opacity-90"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
          <Link
            to="/referrals"
            className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
