import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Flame, ArrowLeftRight, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  targetUserId: string;
  currentBalance: number;
}

export function DevBossPanel({ targetUserId, currentBalance }: Props) {
  const { isDev, isBoss } = useRole();
  const qc = useQueryClient();

  const [override, setOverride] = useState("");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const [reclaimAmount, setReclaimAmount] = useState("");
  const [bossNotes, setBossNotes] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-user-profile", targetUserId] });
    qc.invalidateQueries({ queryKey: ["admin-users-list"] });
    qc.invalidateQueries({ queryKey: ["admin-user-audit", targetUserId] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const overrideMut = useMutation({
    mutationFn: async () => {
      const n = Number.parseInt(override, 10);
      if (!Number.isFinite(n) || n < 0) throw new Error("Enter a valid balance");
      const { data, error } = await supabase.rpc("dev_override_balance" as never, {
        target_user_id: targetUserId,
        new_balance: n,
        dev_notes: overrideNotes.trim() || null,
      } as never);
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (bal) => {
      toast.success(`Balance overridden → ${bal}`);
      setOverride(""); setOverrideNotes("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const burnMut = useMutation({
    mutationFn: async () => {
      const n = Number.parseInt(burnAmount, 10);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a positive amount");
      const { data, error } = await supabase.rpc("boss_burn_coins" as never, {
        target_user_id: targetUserId,
        amount: n,
        boss_notes: bossNotes.trim() || null,
      } as never);
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (bal) => {
      toast.success(`🔥 Burned · new balance ${bal}`);
      setBurnAmount("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reclaimMut = useMutation({
    mutationFn: async () => {
      const n = Number.parseInt(reclaimAmount, 10);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a positive amount");
      const { data, error } = await supabase.rpc("boss_reclaim_coins" as never, {
        target_user_id: targetUserId,
        amount: n,
        boss_notes: bossNotes.trim() || null,
      } as never);
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (bal) => {
      toast.success(`Reclaimed · target now ${bal}`);
      setReclaimAmount("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isDev && !isBoss) return null;

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-6 shadow-card space-y-5">
      <header className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-amber-500" />
        <div>
          <h3 className="font-semibold">Dev & Boss controls</h3>
          <p className="text-sm text-muted-foreground">
            Elevated actions. Current balance: <span className="font-semibold">{currentBalance}</span>. All actions audited.
          </p>
        </div>
      </header>

      {isDev && (
        <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
          <Label className="text-sm font-semibold uppercase tracking-wide">Dev · Manual balance override</Label>
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <Input
              type="number" min={0} max={100000000}
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              placeholder="New balance"
            />
            <Input
              value={overrideNotes}
              onChange={(e) => setOverrideNotes(e.target.value)}
              placeholder="Reason (optional)"
              maxLength={200}
            />
            <Button onClick={() => overrideMut.mutate()} disabled={overrideMut.isPending || !override}>
              {overrideMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Override
            </Button>
          </div>
        </div>
      )}

      {isBoss && (
        <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
          <Label className="text-sm font-semibold uppercase tracking-wide">Boss · Burn / reclaim OG coins</Label>
          <Input
            value={bossNotes}
            onChange={(e) => setBossNotes(e.target.value)}
            placeholder="Shared notes (optional)"
            maxLength={200}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-2">
              <Input
                type="number" min={1} max={100000000}
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                placeholder="Amount to burn"
              />
              <Button
                variant="destructive"
                onClick={() => burnMut.mutate()}
                disabled={burnMut.isPending || !burnAmount}
              >
                {burnMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                <span className="ml-2">Burn</span>
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number" min={1} max={100000000}
                value={reclaimAmount}
                onChange={(e) => setReclaimAmount(e.target.value)}
                placeholder="Amount to reclaim"
              />
              <Button
                variant="secondary"
                onClick={() => reclaimMut.mutate()}
                disabled={reclaimMut.isPending || !reclaimAmount}
              >
                {reclaimMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                <span className="ml-2">Reclaim to me</span>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Burn permanently destroys coins. Reclaim transfers them from the target into your own balance.
          </p>
        </div>
      )}
    </section>
  );
}
