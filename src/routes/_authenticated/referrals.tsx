import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Check,
  Gift,
  Users,
  Coins,
  Share2,
  Link2,
  UserPlus,
  Sparkles,
  TrendingUp,
  Flame,
  Infinity as InfinityIcon,
  PiggyBank,
  CheckCircle2,
  Hourglass,
  QrCode,
  Download,
  KeyRound,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BindReferrerCard } from "@/components/referrals/BindReferrerCard";

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

async function copyTextWithFallback(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === "undefined") return false;
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function ReferralsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const codeQ = useQuery({
    queryKey: ["my-referral-code", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.referral_code as string | null) ?? null;
    },
  });
  const myCode = codeQ.data ?? null;

  const link = useMemo(() => {
    if (!user) return "";
    return `https://ogstreamz.co.uk/r/${myCode ?? user.id}`;
  }, [user, myCode]);

  const summaryQ = useQuery({
    queryKey: ["referral-summary", user?.id],
    enabled: !!user,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Summary> => {
      const { data, error } = await supabase.rpc("get_referral_summary");
      if (error) throw error;
      return (data ?? { total_referred: 0, total_earned: 0, recent: [] }) as Summary;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`referrals-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coin_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { type?: string; amount?: number } | null;
          if (row?.type === "referral_cashback") {
            qc.invalidateQueries({ queryKey: ["referral-summary", user.id] });
            if (typeof row.amount === "number" && row.amount > 0) {
              toast.success(`+${row.amount} OG Coins cashback`, {
                description: "A referee just burned coins — your share is in.",
              });
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "referrals",
          filter: `referrer_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["referral-summary", user.id] });
          toast.success("New referral signed up 🎉");
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const handleCopy = async (label = "Referral link copied") => {
    const ok = await copyTextWithFallback(link);
    if (ok) {
      setCopied(true);
      toast.success(label);
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Couldn't copy — long-press the link to copy it manually");
    }
  };

  const copy = () => handleCopy("Referral link copied");
  const inviteAgain = () => handleCopy("Link copied — paste it to invite again 🎁");

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Join OG Streamz",
          text: "Make AI songs on OG Streamz — sign up with my link and we both win:",
          url: link,
        });
        toast.success("Shared — thanks for spreading the word!");
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        toast.message("Share sheet unavailable — copying instead");
      }
    }
    await handleCopy("Link copied — paste it anywhere to share");
  };

  const summary = summaryQ.data ?? { total_referred: 0, total_earned: 0, recent: [] };
  const shortLink = link.replace(/^https?:\/\//, "");

  // Paid vs pending breakdown.
  // Cashback rows are credited the moment a referee burns (>=10 coins),
  // so every referral_cashback row is "Paid". Pending = referees who
  // signed up but haven't earned us a cashback row yet.
  const paidCoins = summary.total_earned;
  const paidEvents = summary.recent.length;
  const paidRefereeIds = new Set(
    summary.recent.map((r) => r.referee_id).filter((id): id is string => !!id),
  );
  const pendingReferees = Math.max(0, summary.total_referred - paidRefereeIds.size);

  const downloadQR = (svgId: string, filename: string) => {
    if (typeof document === "undefined") return;
    const svg = document.getElementById(svgId) as SVGSVGElement | null;
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("QR code saved");
  };

  return (
    <DashboardShell title="Earnings">
      <div className="w-full space-y-8 sm:space-y-10">
        {/* HERO — earnings-first */}
        <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card/80 to-background p-6 shadow-glow sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl"
          />

          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                <PiggyBank className="h-3 w-3" /> Earnings · 10% lifetime
              </div>
              <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
                Earn{" "}
                <span className="bg-gradient-to-r from-primary via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
                  OG Coins
                </span>{" "}
                every time your crew creates.
              </h1>
              <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
                Share your OG Link. When someone you invited burns coins making songs, you bank{" "}
                <span className="font-semibold text-foreground">10% in OG Coins</span> — automatically,
                forever. No cap, no expiry, no payout fees.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Pill icon={<InfinityIcon className="h-3 w-3" />} label="Lifetime commission" />
                <Pill icon={<Flame className="h-3 w-3" />} label="Auto-paid on every burn" />
                <Pill icon={<Coins className="h-3 w-3" />} label="Spend instantly in-app" />
              </div>
            </div>

            {/* Big balance card */}
            <div className="relative rounded-2xl border border-white/15 bg-background/70 p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-primary" /> Your cashback wallet
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <TrendingUp className="h-3 w-3" /> Live
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <div className="font-display text-5xl font-black tabular-nums sm:text-6xl">
                  {summary.total_earned.toLocaleString()}
                </div>
                <div className="pb-2 text-sm font-semibold text-primary">OG Coins</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Earned from <span className="font-semibold text-foreground">{summary.total_referred}</span>{" "}
                {summary.total_referred === 1 ? "referral" : "referrals"} so far
              </div>

              <div className="mt-5 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={share} className="flex-1 gap-2">
                  <Share2 className="h-4 w-4" /> Share & earn
                </Button>
                <Button variant="secondary" onClick={copy} className="gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (typeof document === "undefined") return;
                  const el = document.getElementById("bind-referrer");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setTimeout(() => {
                    const input = document.getElementById("og-leader-code-input") as HTMLInputElement | null;
                    input?.focus();
                  }, 400);
                }}
                className="mt-2 w-full gap-2 border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
              >
                <KeyRound className="h-4 w-4" /> Connect OG Leader (enter code)
              </Button>
            </div>
          </div>
        </section>

        <div id="bind-referrer" className="scroll-mt-24">
          <BindReferrerCard />
        </div>

        {/* SHARE CARD — primary action */}
        <section className="rounded-3xl border border-white/10 bg-card/70 p-5 backdrop-blur-xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                Your OG Link
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Drop it in group chats, your bio, or DMs. Anyone who signs up = lifetime 10%.
              </div>
            </div>
            <span className="hidden rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300 sm:inline-flex">
              Active
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    readOnly
                    value={shortLink}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-11 pl-9 font-mono text-xs sm:text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={copy} className="h-11 gap-2">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="secondary" onClick={inviteAgain} className="h-11 gap-2">
                    <Gift className="h-4 w-4" /> Invite again
                  </Button>
                  <Button variant="outline" onClick={share} className="h-11 gap-2">
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: the link must be opened by a brand-new account within 24h of sign-up to count.
              </p>

              {/* OG Leader Code — same identifier as the referral link, formatted for typing */}
              {user && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                      Your OG Leader code
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const ok = await copyTextWithFallback(user.id);
                        ok ? toast.success("OG Leader code copied") : toast.error("Couldn't copy");
                      }}
                      className="h-7 gap-1.5 px-2 text-[11px]"
                    >
                      <Copy className="h-3 w-3" /> Copy code
                    </Button>
                  </div>
                  <div className="mt-1 break-all font-mono text-xs sm:text-sm">{user.id}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Share this code with anyone you invite — they paste it into "Connect OG Leader" to lock you in as their referrer for life.
                  </div>
                </div>
              )}
            </div>

            {/* QR card */}
            {link && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-background/60 p-3 md:w-44">
                <div className="rounded-xl bg-white p-2.5">
                  <QRCodeSVG
                    id="og-referral-qr"
                    value={link}
                    size={144}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <QrCode className="h-3 w-3" /> Scan to join
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadQR("og-referral-qr", "og-referral-qr.svg")}
                  className="h-7 gap-1.5 px-2 text-[11px]"
                >
                  <Download className="h-3 w-3" /> Save QR
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* STATS — Paid vs Pending breakdown */}
        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            label="Paid earnings"
            value={paidCoins}
            hint={`${paidEvents} settled cashback ${paidEvents === 1 ? "event" : "events"}`}
            accent="from-emerald-500/30"
          />
          <StatCard
            icon={<Hourglass className="h-5 w-5 text-amber-400" />}
            label="Pending referees"
            value={pendingReferees}
            hint="Signed up — awaiting their first qualifying burn"
            accent="from-amber-500/30"
          />
          <StatCard
            icon={<Users className="h-5 w-5 text-sky-400" />}
            label="Total referred"
            value={summary.total_referred}
            hint="Lifetime confirmed sign-ups"
            accent="from-sky-500/30"
          />
        </section>


        {/* HOW IT WORKS */}
        <section className="rounded-3xl border border-white/10 bg-card/60 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-xl font-black tracking-tight">How you earn</h2>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              3 steps · zero effort after
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Step
              icon={<Link2 className="h-4 w-4" />}
              n={1}
              title="Share your OG Link"
              body="Drop it in group chats, socials or DMs. One link works everywhere."
            />
            <Step
              icon={<UserPlus className="h-4 w-4" />}
              n={2}
              title="They sign up & create"
              body="A friend opens your link, makes an account and starts cooking tracks."
            />
            <Step
              icon={<Sparkles className="h-4 w-4" />}
              n={3}
              title="You bank 10% forever"
              body="Every OG Coin they burn, 10% drops straight into your balance — auto."
            />
          </div>
        </section>

        {/* HISTORY */}
        <section className="rounded-3xl border border-white/10 bg-card/60 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-black tracking-tight">Cashback history</h2>
            <span className="text-xs text-muted-foreground">Last 20 events</span>
          </div>
          <div className="mt-3 divide-y divide-white/5">
            {summaryQ.isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!summaryQ.isLoading && summary.recent.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
                  <Coins className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold">No cashback yet</div>
                <div className="max-w-xs text-xs text-muted-foreground">
                  Share your OG Link to start earning. The first burn from a referee lands here.
                </div>
                <Button size="sm" onClick={share} className="mt-2 gap-2">
                  <Share2 className="h-3.5 w-3.5" /> Share your link
                </Button>
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
                      <div className="flex items-center gap-2 truncate text-sm font-semibold">
                        {tx.referee_name ?? "Referred user"}
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Paid
                        </span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        Burned {burned ?? "?"} coins · you earned{" "}
                        <span className="font-semibold text-primary">+{tx.amount}</span>
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

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-foreground/85">
      <span className="text-primary">{icon}</span>
      {label}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-card/70 p-5 backdrop-blur-xl transition-all hover:border-white/20">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${accent} to-transparent blur-2xl`}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-2 font-display text-4xl font-black tabular-nums">{value.toLocaleString()}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function Step({
  icon,
  n,
  title,
  body,
}: {
  icon: React.ReactNode;
  n: number;
  title: string;
  body: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-background/40 p-4">
      <div className="absolute right-3 top-2 font-display text-5xl font-black text-white/[0.04]">
        {n}
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary">
            {icon}
          </span>
          Step {n}
        </div>
        <div className="mt-2 text-sm font-bold text-foreground">{title}</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
