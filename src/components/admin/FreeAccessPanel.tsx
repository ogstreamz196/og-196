import { Loader2, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useFreeAccess, useSetFreeAccess } from "@/hooks/use-free-access";

export function FreeAccessPanel() {
  const { enabled, isLoading } = useFreeAccess();
  const mut = useSetFreeAccess();
  return (
    <section className="mb-6 rounded-2xl border border-primary/30 bg-primary/[0.05] p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h3 className="font-semibold">Free access for all users</h3>
            <p className="text-sm text-muted-foreground">
              Limited-time promo: every signed-in user gets VIP-only features,
              including OG Bot foul-mouth mode. Switch off to restore VIP-only access.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Status:{" "}
              <span className={enabled ? "text-emerald-400 font-medium" : "text-muted-foreground"}>
                {isLoading ? "loading…" : enabled ? "ON — everyone unlocked" : "OFF — VIP only"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mut.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={enabled}
            disabled={isLoading || mut.isPending}
            onCheckedChange={(v) => mut.mutate(v)}
            aria-label="Toggle free access for all users"
          />
        </div>
      </div>
    </section>
  );
}
