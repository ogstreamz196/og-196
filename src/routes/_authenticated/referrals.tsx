import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, Gift, Users, Coins, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/referrals")({
  component: ReferralsPage,
});

type Summary = {
  total_referred: number;
  total_earned: number;
  recent: {
    id: string;
    amount: number;
    reference: string | null;
    created_at: string;
    referee_id: string | null;
    referee_name: string | null;
  }[];
};

function ReferralsPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => {
    if (!user) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://ogstreamz.co.uk";
    return `${origin}/welcome?ref=${user.id}`;
  }, [user]);

  const summaryQ = useQuery({
    queryKey: ["referral-summary", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Summary> => {
      const { data, error } = await supabase.rpc("get_referral_summary");
      if (error) throw error;
      return (data ?? { total_referred: 0, total_earned: 0, recent: [] }) as Summary;
    },
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Referral link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Join OG Streamz",
          text: "Make AI songs on OG Streamz — sign up with my link:",
          url: link,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  const summary = summaryQ.data ?? { total_referred: 0, total_earned: 0, recent: [] };

  return (
    <DashboardShell title="Referrals">
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
            <Gift className="h-3 w-3" /> Referrals
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight">Invite friends, earn coins</h1>
          <p className="text-sm text-muted-foreground">
            Share your link. When someone signs up through it, you get{" "}
            <span className="font-semibold text-foreground">10% cashback in OG Coins</span> every
            time they burn coins — forever.
          </p>
        </header>

        {/* Running totals — top of page */}
        <section className="grid gap-3 sm:grid-cols-2">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="People you referred"
            value={summary.total_referred}
            hint="Confirmed sign-ups via your link"
          />
          <StatCard
            icon={<Coins className="h-5 w-5 text-primary" />}
            label="Total cashback earned"
            value={summary.total_earned}
            hint="OG Coins from 10% on referee burns"
          />
        </section>

        {/* Share card */}
        <section className="rounded-2xl border border-white/10 bg-card/60 p-5 shadow-glow">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Your referral link
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="secondary" onClick={copy} className="gap-2">
                <Gift className="h-4 w-4" /> Invite again
              </Button>
              <Button variant="outline" onClick={share} className="gap-2">
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: the link must be opened by a brand-new account within 24h of sign-up to count.
          </p>
        </section>

        {/* Recent earnings */}
        <section className="rounded-2xl border border-white/10 bg-card/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Cashback history</h2>
            <span className="text-xs text-muted-foreground">Last 20 events</span>
          </div>
          <div className="mt-3 divide-y divide-white/5">
            {summaryQ.isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!summaryQ.isLoading && summary.recent.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No cashback yet. Share your link to start earning.
              </div>
            )}
            {summary.recent.map((tx) => {
              const burned = tx.reference?.match(/burn:(\d+)/)?.[1];
              const when = new Date(tx.created_at);
              return (
                <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold uppercase text-primary">
                      {(tx.referee_name ?? "?").slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {tx.referee_name ?? "Referred user"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        Burned {burned ?? "?"} coins · you earned +{tx.amount}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{when.toLocaleDateString()}</div>
                    <div>{when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </DashboardShell>
  );
}

function StatCard({
  icon, label, value, hint,
}: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card/60 p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-4xl font-black">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
