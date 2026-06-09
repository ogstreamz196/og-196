import { Coins } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

export function CoinBalance({ className }: { className?: string }) {
  const { data, isLoading } = useProfile();
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 shadow-card",
        className,
      )}
    >
      <Coins className="h-4 w-4 text-coin" />
      <span className="text-sm font-semibold tabular-nums">
        {isLoading ? "—" : (data?.coin_balance ?? 0)}
      </span>
      <span className="text-xs text-muted-foreground">coins</span>
    </div>
  );
}
