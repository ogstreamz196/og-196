import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * One-line earnings nudge — promotes the 10% cashback referral loop
 * inline on any page. Designed to be small enough to slot into headers,
 * footers, or between cards without dominating the layout.
 */
export function EarnCoinStrip({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "muted";
}) {
  const { user } = useAuth();
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

  if (!user) return null;

  const shortCode = (code ?? "").replace(/^OG-/, "");
  const shareUrl =
    typeof window !== "undefined" && shortCode
      ? `${window.location.origin}/r/${shortCode}`
      : null;

  async function share(e: React.MouseEvent) {
    e.preventDefault();
    if (!shareUrl) return;
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (nav && "share" in nav) {
      try {
        await nav.share({
          title: "Join me on OG",
          text: `Use my OG code ${code} — we both earn coins.`,
          url: shareUrl,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied — share it to earn 10% cashback");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <Link
      to="/referrals"
      className={cn(
        "group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coin/60",
        tone === "muted"
          ? "border-white/10 bg-white/[0.04] text-foreground/80 hover:border-coin/40 hover:text-foreground"
          : "border-coin/40 bg-gradient-to-r from-coin/15 via-coin/10 to-transparent text-foreground hover:border-coin",
        className,
      )}
      aria-label="Earn 10% cashback by referring friends"
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-coin" />
      <span className="truncate">
        Earn <b className="text-coin">10% cashback</b>
        {shortCode && (
          <>
            {" "}· code <code className="font-mono">{code}</code>
          </>
        )}
      </span>
      {shareUrl && (
        <button
          type="button"
          onClick={share}
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-coin/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-coin hover:bg-coin/30"
          aria-label="Share your referral link"
        >
          <Share2 className="h-3 w-3" /> Share
        </button>
      )}
    </Link>
  );
}
