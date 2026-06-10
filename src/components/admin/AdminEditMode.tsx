import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X, Loader2, Coins, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// --------- Context ---------
interface Ctx { enabled: boolean; toggle: () => void; }
const AdminEditCtx = createContext<Ctx>({ enabled: false, toggle: () => {} });

export function AdminEditModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const toggle = useCallback(() => setEnabled((v) => !v), []);
  const value = useMemo(() => ({ enabled, toggle }), [enabled, toggle]);
  return <AdminEditCtx.Provider value={value}>{children}</AdminEditCtx.Provider>;
}

export function useAdminEditMode() { return useContext(AdminEditCtx); }

// --------- Toggle button (admins only) ---------
export function AdminEditModeToggle({ className }: { className?: string }) {
  const { isAdmin } = useRole();
  const { enabled, toggle } = useAdminEditMode();
  if (!isAdmin) return null;
  return (
    <Button
      type="button"
      onClick={toggle}
      size="sm"
      variant={enabled ? "default" : "outline"}
      className={cn("gap-1.5", enabled && "bg-gradient-brand text-primary-foreground", className)}
      title="Toggle admin edit mode"
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {enabled ? "Editing on" : "Edit mode"}
    </Button>
  );
}

// --------- Editable label (display_name) ---------
interface EditableLabelProps {
  userId: string;
  value: string | null | undefined;
  fallback?: string;
  className?: string;
}

export function AdminEditableLabel({ userId, value, fallback, className }: EditableLabelProps) {
  const { enabled } = useAdminEditMode();
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  const mut = useMutation({
    mutationFn: async () => {
      const notes = window.prompt("Reason (optional, saved to audit log):", "") ?? "";
      const { data, error } = await supabase.rpc("admin_update_profile_label", {
        target_user_id: userId,
        new_display_name: draft,
        admin_notes: notes,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      toast.success("Label updated & logged");
      qc.invalidateQueries({ queryKey: ["admin-profiles-search"] });
      qc.invalidateQueries({ queryKey: ["admin-user-audit", userId] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
    },
    onError: (e: Error) => {
      const m = e.message.toLowerCase();
      if (m.includes("invalid_display_name")) toast.error("Name must be 1–80 chars.");
      else if (m.includes("unauthorized")) toast.error("Not allowed.");
      else toast.error(e.message);
    },
  });

  const display = value || fallback || "—";
  if (!enabled || !isAdmin) return <span className={className}>{display}</span>;

  if (editing) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") mut.mutate();
            if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
          }}
          className="h-7 w-44 text-sm"
          maxLength={80}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7"
          disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7"
          onClick={() => { setDraft(value ?? ""); setEditing(false); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className={cn(
        "group inline-flex items-center gap-1 rounded px-1 -mx-1 outline-dashed outline-1 outline-primary/40 hover:bg-primary/10",
        className,
      )}
      title="Edit label (admin)"
    >
      <span>{display}</span>
      <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

// --------- Editable balance ---------
interface EditableBalanceProps {
  userId: string;
  value: number;
  className?: string;
  showIcon?: boolean;
}

export function AdminEditableBalance({ userId, value, className, showIcon = true }: EditableBalanceProps) {
  const { enabled } = useAdminEditMode();
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const mut = useMutation({
    mutationFn: async () => {
      const next = Number(draft);
      if (!Number.isFinite(next) || next < 0) throw new Error("Balance must be ≥ 0");
      const notes = window.prompt("Reason for balance change (saved to audit log):", "") ?? "";
      const { data, error } = await supabase.rpc("set_balance_admin", {
        target_user_id: userId,
        new_balance: Math.trunc(next),
        admin_notes: notes,
      });
      if (error) throw new Error(error.message);
      return data as number;
    },
    onSuccess: (newBal) => {
      toast.success(`Balance set to ${newBal}`);
      qc.invalidateQueries({ queryKey: ["admin-profiles-search"] });
      qc.invalidateQueries({ queryKey: ["admin-user-audit", userId] });
      qc.invalidateQueries({ queryKey: ["admin-mint-history"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
    },
    onError: (e: Error) => {
      const m = e.message.toLowerCase();
      if (m.includes("balance_out_of_range")) toast.error("Balance out of range.");
      else if (m.includes("unauthorized")) toast.error("Not allowed.");
      else if (m.includes("target_not_found")) toast.error("User not found.");
      else toast.error(e.message);
    },
  });

  if (!enabled || !isAdmin) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        {showIcon && <Coins className="h-3.5 w-3.5 text-coin" />}
        <span className="tabular-nums">{value}</span>
      </span>
    );
  }

  if (editing) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <Input
          autoFocus type="number" min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") mut.mutate();
            if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
          }}
          className="h-7 w-24 text-sm"
        />
        <Button size="icon" variant="ghost" className="h-7 w-7"
          disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7"
          onClick={() => { setDraft(String(value)); setEditing(false); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className={cn(
        "group inline-flex items-center gap-1 rounded px-1 -mx-1 outline-dashed outline-1 outline-primary/40 hover:bg-primary/10",
        className,
      )}
      title="Set balance (admin)"
    >
      {showIcon && <Coins className="h-3.5 w-3.5 text-coin" />}
      <span className="tabular-nums">{value}</span>
      <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
