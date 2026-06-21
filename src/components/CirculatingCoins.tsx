import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Flame, Wallet } from "lucide-react";
import { getCoinStats } from "@/lib/coin-stats.functions";

function format(n: number) {
  return new Intl.NumberFormat("en-GB").format(n);
}

/**
 * Side-by-side economy snapshot: total minted vs currently circulating,
 * with a burnt counter (coins consumed by generations & purchases).
 * Public read — safe to render on signed-out screens too.
 */
export function CirculatingCoins() {
  const fetchStats = useServerFn(getCoinStats);
  const { data, isLoading } = useQuery({
    queryKey: ["coin-stats"],
    queryFn: () => fetchStats(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const stats = [
    {
      key: "minted",
      label: "Minted",
      help: "Total OG Coins ever issued",
      value: data?.minted ?? 0,
      Icon: Coins,
      tone: "text-coin",
    },
    {
      key: "circulating",
      label: "Circulating",
      help: "Held across all wallets right now",
      value: data?.inWallets ?? 0,
      Icon: Wallet,
      tone: "text-primary",
    },
    {
      key: "burnt",
      label: "Burnt",
      help: "Spent on generations & unlocks",
      value: data?.burnt ?? 0,
      Icon: Flame,
      tone: "text-orange-400",
    },
  ];

  return (
    <section
      aria-label="OG Coin economy"
      className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-xl sm:p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
      <div className="relative grid grid-cols-3 gap-3 sm:gap-5">
        {stats.map(({ key, label, help, value, Icon, tone }) => (
          <div
            key={key}
            className="flex flex-col items-start gap-1 rounded-2xl border border-white/10 bg-background/30 p-3 sm:p-4"
          >
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${tone}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{label}</span>
            </div>
            <div
              className="font-display text-3xl font-black tabular-nums leading-none sm:text-4xl"
              aria-live="polite"
            >
              {isLoading ? "—" : format(value)}
            </div>
            <p className="text-[11px] leading-tight text-muted-foreground">{help}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
