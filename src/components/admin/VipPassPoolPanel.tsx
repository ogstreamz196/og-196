import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, Plus, Trash2, Eye, EyeOff, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addVipPassCredentials,
  deleteVipPassCredential,
  listVipPassCredentials,
  updateVipPassCredential,
} from "@/lib/vip-pass.functions";

/**
 * Boss Controls → Store settings: the pool of reusable OG VIP PASS logins.
 * Each buyer is shown one random active login; the same login can be shared
 * by many members and edited/rotated here anytime.
 */
export function VipPassPoolPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listVipPassCredentials);
  const add = useServerFn(addVipPassCredentials);
  const update = useServerFn(updateVipPassCredential);
  const remove = useServerFn(deleteVipPassCredential);
  const [text, setText] = useState("");
  const [reveal, setReveal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState("");
  const [editPass, setEditPass] = useState("");

  const query = useQuery({ queryKey: ["vip-pass-pool"], queryFn: () => list() });
  const rows = query.data ?? [];
  const available = rows.filter((r) => r.active).length;

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

  const saveMut = useMutation({
    mutationFn: (v: { id: string; active?: boolean; username?: string; password?: string }) =>
      update({ data: v }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast.success("Login updated — buyers see the new details straight away");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Pass removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (id: string, username: string, password: string) => {
    setEditingId(id);
    setEditUser(username);
    setEditPass(password);
  };

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">OG VIP Pass logins</h2>
            <p className="text-xs text-muted-foreground">
              {available} active · {rows.length} total. Reusable — each buyer gets one at random.
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
          No VIP logins yet. Paste a few above — members each get one at random.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-3 py-2"
            >
              {editingId === row.id ? (
                <div className="min-w-0 space-y-2">
                  <Input value={editUser} onChange={(e) => setEditUser(e.target.value)} aria-label="Username" className="h-8 font-mono text-xs" />
                  <Input value={editPass} onChange={(e) => setEditPass(e.target.value)} aria-label="Password" className="h-8 font-mono text-xs" />
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">
                    {row.username}
                    <span className="text-muted-foreground"> / {reveal ? row.password : "••••••••"}</span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.claims} member{row.claims === 1 ? "" : "s"} hold this login · {row.active ? "Active" : "Disabled"}
                  </p>
                </div>
              )}
              <div className="flex shrink-0 items-center gap-1">
                {editingId === row.id ? (
                  <>
                    <Button
                      size="icon-sm"
                      aria-label="Save login"
                      disabled={saveMut.isPending || !editUser.trim() || !editPass.trim()}
                      onClick={() => saveMut.mutate({ id: row.id, username: editUser, password: editPass })}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Cancel editing" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit ${row.username}`}
                      onClick={() => startEdit(row.id, row.username, row.password)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saveMut.isPending}
                      onClick={() => saveMut.mutate({ id: row.id, active: !row.active })}
                    >
                      {row.active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${row.username}`}
                      disabled={row.claims > 0 || delMut.isPending}
                      onClick={() => delMut.mutate(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
