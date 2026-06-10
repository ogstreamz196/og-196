import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, RefreshCw, Lock, Unlock, Music2, Save, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { useSettings } from "@/hooks/use-settings";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PortalManager } from "@/components/admin/PortalManager";
import { MintCoinsPanel } from "@/components/admin/MintCoinsPanel";
import { AdminEditableLabel, AdminEditableBalance } from "@/components/admin/AdminEditMode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminPanel,
});

interface AdminSong {
  id: string;
  user_id: string;
  title: string | null;
  prompt: string;
  status: string;
  unlocked: boolean;
  error_message: string | null;
  created_at: string;
}

function AdminPanel() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const qc = useQueryClient();

  const songsQuery = useQuery({
    queryKey: ["admin-songs"],
    enabled: isAdmin,
    queryFn: async (): Promise<(AdminSong & { email: string | null; display_name: string | null; coin_balance: number })[]> => {
      const { data: songs, error } = await supabase
        .from("songs")
        .select("id, user_id, title, prompt, status, unlocked, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const list = (songs ?? []) as AdminSong[];
      const userIds = Array.from(new Set(list.map((s) => s.user_id)));
      let map = new Map<string, { email: string | null; display_name: string | null; coin_balance: number }>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id, email, display_name, coin_balance").in("id", userIds);
        map = new Map((profs ?? []).map((p: any) => [p.id, { email: p.email, display_name: p.display_name, coin_balance: p.coin_balance }]));
      }
      return list.map((s) => ({
        ...s,
        email: map.get(s.user_id)?.email ?? null,
        display_name: map.get(s.user_id)?.display_name ?? null,
        coin_balance: map.get(s.user_id)?.coin_balance ?? 0,
      }));
    },
  });

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-songs-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "songs" },
        () => songsQuery.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const toggleUnlock = useMutation({
    mutationFn: async ({ id, unlocked }: { id: string; unlocked: boolean }) => {
      const { error } = await supabase.from("songs").update({ unlocked }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-songs"] });
      toast.success("Song updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reprocess = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("admin-reprocess", {
        body: { song_id: id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-songs"] });
      toast.success("Reprocessing started");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (roleLoading) {
    return (
      <DashboardShell title="Boss Panel">
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <DashboardShell title="Boss Panel">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Admin controls</h2>
            <p className="text-sm text-muted-foreground">Pricing, portals, recent generations, manual unlocks, and retries.</p>
          </div>
          <Link to="/admin/users">
            <Button size="sm" variant="outline">
              <ShieldCheck className="mr-2 h-4 w-4" /> Manage users
            </Button>
          </Link>
          <Link to="/admin/og-bot">
            <Button size="sm" variant="outline">OG Bot Tokens</Button>
          </Link>
          <Link to="/admin/og-persona">
            <Button size="sm" variant="outline">OG Bot Persona</Button>
          </Link>
          <Link to="/admin/user-settings">
            <Button size="sm" variant="outline">User Settings</Button>
          </Link>
          <Link to="/admin/create-portal">
            <Button size="sm" className="bg-gradient-brand text-primary-foreground">
              <Music2 className="mr-2 h-4 w-4" /> New Portal
            </Button>
          </Link>
        </div>

        <PricingControls />

        <MintCoinsPanel />

        <PortalManager />





        <div className="rounded-2xl border border-border bg-card shadow-card">
          {songsQuery.isLoading ? (
            <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : songsQuery.data && songsQuery.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Song</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Unlocked</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {songsQuery.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-[260px]">
                      <div className="truncate font-medium">{s.title || "Untitled"}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.prompt}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="text-muted-foreground">{s.email ?? s.user_id.slice(0, 8)}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs">
                        <AdminEditableLabel userId={s.user_id} value={s.display_name} fallback="No label" />
                        <AdminEditableBalance userId={s.user_id} value={s.coin_balance} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        s.status === "completed" && "bg-primary/15 text-primary",
                        (s.status === "pending" || s.status === "processing") && "bg-muted text-muted-foreground",
                        s.status === "failed" && "bg-destructive/15 text-destructive",
                      )}>
                        {s.status}
                      </span>
                      {s.status === "failed" && s.error_message && (
                        <div className="mt-1 max-w-[200px] truncate text-xs text-destructive/80">{s.error_message}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                        s.unlocked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        {s.unlocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {s.unlocked ? "Unlocked" : "Locked"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant={s.unlocked ? "outline" : "default"}
                          disabled={toggleUnlock.isPending}
                          onClick={() => toggleUnlock.mutate({ id: s.id, unlocked: !s.unlocked })}
                        >
                          {s.unlocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                          <span className="ml-1.5">{s.unlocked ? "Lock" : "Unlock"}</span>
                        </Button>
                        {s.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reprocess.isPending}
                            onClick={() => reprocess.mutate(s.id)}
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", reprocess.isPending && "animate-spin")} />
                            <span className="ml-1.5">Retry</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid place-items-center gap-2 py-16 text-muted-foreground">
              <Music2 className="h-8 w-8" />
              <p>No songs yet.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function PricingControls() {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [coins, setCoins] = useState<string>("");
  const [songs, setSongs] = useState<string>("");
  const [sample, setSample] = useState<string>("");

  useEffect(() => {
    if (settings) {
      setCoins(String(settings.coins_per_generation));
      setSongs(String(settings.songs_per_generation));
      setSample(String(settings.sample_seconds));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "coins_per_generation", value: Number(coins) },
        { key: "songs_per_generation", value: Number(songs) },
        { key: "sample_seconds", value: Number(sample) },
      ];
      for (const u of updates) {
        if (!Number.isFinite(u.value) || u.value < 0) throw new Error(`Invalid ${u.key}`);
        const { error } = await supabase.from("app_settings").update({ value: u.value }).eq("key", u.key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Pricing updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Coins className="h-4 w-4 text-coin" />
        <h3 className="font-semibold">Pricing & limits</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="coins">Coins per generation</Label>
          <Input id="coins" type="number" min={0} value={coins} onChange={(e) => setCoins(e.target.value)} className="mt-2" />
        </div>
        <div>
          <Label htmlFor="songs">Songs per generation</Label>
          <Input id="songs" type="number" min={1} max={4} value={songs} onChange={(e) => setSongs(e.target.value)} className="mt-2" />
        </div>
        <div>
          <Label htmlFor="sample">Sample length (seconds)</Label>
          <Input id="sample" type="number" min={5} max={600} value={sample} onChange={(e) => setSample(e.target.value)} className="mt-2" />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save pricing
        </Button>
      </div>
    </div>
  );
}
