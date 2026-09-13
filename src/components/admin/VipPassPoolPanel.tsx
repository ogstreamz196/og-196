import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addVipPassCredentials,
  deleteVipPassCredential,
  listVipPassCredentials,
  updateVipPassCredential,
} from "@/lib/vip-pass.functions";

/**
 * Boss Controls → Store settings: the pool of OG VIP PASS logins.
 * Buyers are assigned one unused login at random when they purchase.
 */
export function VipPassPoolPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listVipPassCredentials);
  const add = useServerFn(addVipPassCredentials);
  const update = useServerFn(updateVipPassCredential);
  const remove = useServerFn(deleteVipPassCredential);
  const [text, setText] = useState("");
  const [reveal, setReveal] = useState(false);

  const query = useQuery({ queryKey: ["vip-pass-pool"], queryFn: () => list() });
  const rows = query.data ?? [];
  const available = rows.filter((r) => !r.assigned_user_id && r.active).length;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vip-pass-pool"] });
    qc.invalidateQueries({ queryKey: ["vip-pass-status"] });
  };

  const addMut = useMutation({
    mutationFn: () => add({ data: { text } }),
    onSuccess: (result) => {
      setText("");
      invalidate();
      const extra = [
        result.duplicates.length ? `${result.duplicates.length} already existed` : "",
        result.skipped.length ? `${result.skipped.length} lines skipped` : "",
      ].filter(Boolean).join(" · ");
      toast.success(`${result.added} pass${result.added === 1 ? "" : "es"} added${extra ? ` — ${extra}` : ""}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => update({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Pass removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">OG VIP Pass logins</h2>
            <p className="text-xs text-muted-foreground">
              {available} available · {rows.length} total. Buyers get one at random.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setReveal((v) => !v)}>
          {reveal ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
          {reveal ? "Hide passwords" : "Show passwords"}
        </Button>
      </header>

      <div className="mb-4 space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={"username:password\nuser2:pass2"}
          aria-label="Paste VIP logins, one per line"
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">One per line — separate with : , | or a space.</p>
          <Button size="sm" className="bg-gradient-brand" disabled={!text.trim() || addMut.isPending} onClick={() => addMut.mutate()}>
            {addMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Add logins
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No VIP logins yet. Paste some above so members can buy the pass.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm">
                  {row.username}
                  <span className="text-muted-foreground"> / {reveal ? row.password : "••••••••"}</span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {row.assigned_user_id
                    ? `Claimed by ${row.assigned_email ?? row.assigned_user_id}`
                    : row.active ? "Available" : "Disabled"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!row.assigned_user_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={toggleMut.isPending}
                    onClick={() => toggleMut.mutate({ id: row.id, active: !row.active })}
                  >
                    {row.active ? "Disable" : "Enable"}
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${row.username}`}
                  disabled={!!row.assigned_user_id || delMut.isPending}
                  onClick={() => delMut.mutate(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
