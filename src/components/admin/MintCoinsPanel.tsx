import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Loader2, Plus, Minus, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface MintTx {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  reference: string | null;
  created_at: string;
  email?: string | null;
}

export function MintCoinsPanel() {
  const qc = useQueryClient();
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("");

  const recent = useQuery({
    queryKey: ["admin-mint-history"],
    queryFn: async (): Promise<MintTx[]> => {
      const { data, error } = await supabase
        .from("coin_transactions")
        .select("id, user_id, amount, type, reference, created_at")
        .in("type", ["mint", "admin_deduct"])
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      const list = (data ?? []) as MintTx[];
      const ids = Array.from(new Set(list.map((t) => t.user_id)));
      if (!ids.length) return list;
      const { data: profs } = await supabase
        .from("profiles").select("id, email").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.email]));
      return list.map((t) => ({ ...t, email: map.get(t.user_id) ?? null }));
    },
  });

  const mint = useMutation({
    mutationFn: async (signedAmount: number) => {
      const v = target.trim();
      if (!v) throw new Error("Enter a user email or ID");
      if (!Number.isFinite(signedAmount) || signedAmount === 0)
        throw new Error("Amount must be a non-zero integer");

      const looksLikeUuid = /^[0-9a-f-]{36}$/i.test(v);
      const body: Record<string, unknown> = {
        amount: Math.trunc(signedAmount),
        reason: reason.trim() || "admin_mint",
      };
      if (looksLikeUuid) body.user_id = v;
      else body.email = v;

      const { data, error } = await supabase.functions.invoke("admin-mint-coins", { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { user_id: string; new_balance: number; amount: number };
    },
    onSuccess: (data) => {
      toast.success(
        `${data.amount > 0 ? "Awarded" : "Deducted"} ${Math.abs(data.amount)} coins · new balance ${data.new_balance}`,
      );
      qc.invalidateQueries({ queryKey: ["admin-mint-history"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const numericAmount = Number(amount);
  const disabled = mint.isPending || !target.trim() || !Number.isFinite(numericAmount) || numericAmount === 0;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Coins className="h-4 w-4 text-coin" />
        <h3 className="font-semibold">Mint &amp; Award coins</h3>
        <span className="ml-auto text-xs text-muted-foreground">Admin-only · server-verified</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1.4fr_0.7fr]">
        <div>
          <Label htmlFor="mint-target">Target user (email or user ID)</Label>
          <Input
            id="mint-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="user@example.com"
            className="mt-2"
            maxLength={320}
          />
        </div>
        <div>
          <Label htmlFor="mint-amount">Amount</Label>
          <Input
            id="mint-amount"
            type="number"
            min={1}
            max={100000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-2"
          />
        </div>
      </div>
      <div className="mt-4">
        <Label htmlFor="mint-reason">Reason (optional, shown in history)</Label>
        <Textarea
          id="mint-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. promo grant, refund for failed batch"
          maxLength={200}
          className="mt-2 resize-none"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => mint.mutate(Math.abs(numericAmount))}
          disabled={disabled}
          className="bg-gradient-brand text-primary-foreground"
        >
          {mint.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Award {Math.abs(numericAmount || 0)} coins
        </Button>
        <Button
          variant="outline"
          onClick={() => mint.mutate(-Math.abs(numericAmount))}
          disabled={disabled}
        >
          <Minus className="mr-2 h-4 w-4" />
          Deduct {Math.abs(numericAmount || 0)}
        </Button>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <History className="h-4 w-4" /> Recent admin changes
        </div>
        {recent.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : recent.data && recent.data.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background/40 text-sm">
            {recent.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.email ?? t.user_id.slice(0, 8)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.reference || t.type} · {new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
                <div className={t.amount >= 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>
                  {t.amount >= 0 ? "+" : ""}{t.amount}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No mint activity yet.</p>
        )}
      </div>
    </div>
  );
}
