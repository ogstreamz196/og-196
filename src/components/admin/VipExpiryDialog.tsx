import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Mode = "lifetime" | "months" | "custom";

export function useVipExpiry(userId: string, enabled = true) {
  return useQuery({
    queryKey: ["admin-vip-expiry", userId],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("expires_at" as never)
        .eq("user_id", userId)
        .eq("role", "vip")
        .maybeSingle();
      return ((data as { expires_at?: string | null } | null)?.expires_at ?? null) as
        | string
        | null;
    },
  });
}

export function formatVipExpiry(expiresAt: string | null | undefined) {
  if (!expiresAt) return "Lifetime";
  return `Until ${new Date(expiresAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function VipExpiryDialog({
  open,
  onOpenChange,
  userId,
  isVip,
  currentExpiry,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  isVip: boolean;
  currentExpiry?: string | null;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("months");
  const [months, setMonths] = useState("12");
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (!open) return;
    if (isVip && !currentExpiry) setMode("lifetime");
    else if (isVip && currentExpiry) {
      setMode("custom");
      setCustom(toDateInput(new Date(currentExpiry)));
    } else setMode("months");
  }, [open, isVip, currentExpiry]);

  const mut = useMutation({
    mutationFn: async () => {
      let expires: string | null = null;
      if (mode === "months") {
        const d = new Date();
        d.setMonth(d.getMonth() + Number(months));
        expires = d.toISOString();
      } else if (mode === "custom") {
        if (!custom) throw new Error("Pick a date");
        const d = new Date(`${custom}T23:59:59`);
        if (d.getTime() <= Date.now()) throw new Error("Date must be in the future");
        expires = d.toISOString();
      }
      const { error } = await supabase.rpc(
        "set_vip_expiry_admin" as never,
        {
          target_user_id: userId,
          new_expires_at: expires,
          admin_notes: isVip ? "boss_adjust_expiry" : "boss_grant_with_expiry",
        } as never,
      );
      if (error) throw new Error(error.message);
      return expires;
    },
    onSuccess: (expires) => {
      toast.success(`VIP ${isVip ? "updated" : "granted"} · ${formatVipExpiry(expires)}`);
      qc.invalidateQueries({ queryKey: ["admin-vip-expiry", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users-roles"] });
      qc.invalidateQueries({ queryKey: ["admin-user-roles", userId] });
      qc.invalidateQueries({ queryKey: ["user-roles", userId] });
      qc.invalidateQueries({ queryKey: ["admin-user-audit", userId] });
      qc.invalidateQueries({ queryKey: ["user-role"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      const m = e.message.toLowerCase();
      if (m.includes("unauthorized")) toast.error("Not allowed.");
      else if (m.includes("expiry_in_past")) toast.error("Date must be in the future.");
      else toast.error(e.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            {isVip ? "Adjust VIP expiry" : "Grant VIP"}
          </DialogTitle>
          <DialogDescription>
            {isVip ? `Currently: ${formatVipExpiry(currentExpiry)}` : "How long should VIP last?"}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-3">
          <label className="flex items-center gap-3 rounded-lg border border-border p-3">
            <RadioGroupItem value="lifetime" />
            <span className="text-sm font-medium">Lifetime</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-border p-3">
            <RadioGroupItem value="months" />
            <span className="text-sm font-medium">Length</span>
            <Select
              value={months}
              onValueChange={(v) => {
                setMonths(v);
                setMode("months");
              }}
            >
              <SelectTrigger className="ml-auto h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 months</SelectItem>
                <SelectItem value="6">6 months</SelectItem>
                <SelectItem value="3">3 months</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-border p-3">
            <RadioGroupItem value="custom" />
            <span className="text-sm font-medium">Custom date</span>
            <Input
              type="date"
              className="ml-auto h-8 w-40"
              min={toDateInput(new Date(Date.now() + 86_400_000))}
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setMode("custom");
              }}
            />
          </label>
        </RadioGroup>
        <Label className="sr-only">VIP expiry</Label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isVip ? "Save" : "Grant VIP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
