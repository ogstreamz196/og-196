import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { useAdminEditMode } from "./AdminEditMode";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  className?: string;
}

/**
 * Shows a VIP badge for the given user. When admin "Edit mode" is on,
 * clicking the badge grants or revokes VIP and logs the change.
 */
export function VipBadgeAction({ userId, className }: Props) {
  const { isAdmin } = useRole();
  const { enabled } = useAdminEditMode();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["user-roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as string);
    },
  });
  const isVip = (q.data ?? []).includes("vip");

  const mut = useMutation({
    mutationFn: async () => {
      const notes = window.prompt(
        `${isVip ? "Revoke" : "Grant"} VIP — reason (saved to audit log):`,
        "",
      ) ?? "";
      const { error } = await supabase.rpc("set_vip_admin", {
        target_user_id: userId,
        make_vip: !isVip,
        admin_notes: notes,
      });
      if (error) throw new Error(error.message);
      return !isVip;
    },
    onSuccess: (nowVip) => {
      toast.success(nowVip ? "VIP granted & logged" : "VIP revoked & logged");
      qc.invalidateQueries({ queryKey: ["user-roles", userId] });
      qc.invalidateQueries({ queryKey: ["admin-user-audit", userId] });
      qc.invalidateQueries({ queryKey: ["user-role"] });
    },
    onError: (e: Error) => {
      const m = e.message.toLowerCase();
      if (m.includes("unauthorized")) toast.error("Not allowed.");
      else if (m.includes("target_not_found")) toast.error("User not found.");
      else toast.error(e.message);
    },
  });

  if (q.isLoading) {
    return <span className={cn("text-xs text-muted-foreground", className)}>…</span>;
  }

  const badge = (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
      isVip
        ? "bg-coin/15 text-coin"
        : "bg-muted text-muted-foreground",
    )}>
      <Crown className="h-3 w-3" />
      {isVip ? "VIP" : "Standard"}
    </span>
  );

  if (!enabled || !isAdmin) return <span className={className}>{badge}</span>;

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={mut.isPending}
      onClick={() => mut.mutate()}
      className={cn("h-7 gap-1.5 px-2", className)}
      title={isVip ? "Click to revoke VIP" : "Click to grant VIP"}
    >
      {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : badge}
    </Button>
  );
}
