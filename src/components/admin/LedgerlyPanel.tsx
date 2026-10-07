import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpenCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminSection } from "./AdminSection";
import { getLedgerlySettings, saveLedgerlySettings, testLedgerlyConnection } from "@/lib/ledgerly.functions";

export function LedgerlyPanel() {
  const qc = useQueryClient();
  const get = useServerFn(getLedgerlySettings);
  const save = useServerFn(saveLedgerlySettings);
  const test = useServerFn(testLedgerlyConnection);
  const q = useQuery({ queryKey: ["ledgerly-settings"], queryFn: () => get() });
  const [enabled, setEnabled] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  useEffect(() => { if (q.data) setEnabled(q.data.enabled); }, [q.data]);

  const onSave = async () => {
    setBusy("save");
    try {
      await save({ data: { enabled, apiKey: key || undefined } });
      setKey("");
      toast.success("Ledgerly settings saved");
      qc.invalidateQueries({ queryKey: ["ledgerly-settings"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(null); }
  };
  const onTest = async () => {
    setBusy("test");
    try {
      const r = await test();
      r.ok ? toast.success("Ledgerly connected") : toast.error(r.message);
      qc.invalidateQueries({ queryKey: ["ledgerly-settings"] });
    } finally { setBusy(null); }
  };
  const d = q.data;

  return (
    <AdminSection
      icon={<BookOpenCheck className="h-5 w-5 text-primary" />}
      title="Ledgerly Accounting Sync"
      subtitle="Sends every paid live sale to Ledgerly automatically."
      action={
        d?.lastTestOk ? (
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">Connected</span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {d?.enabled ? "Not verified" : "Locked / inactive"}
          </span>
        )
      }
    >
      {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Enable Ledgerly Sync</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </label>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Ledgerly API Key {d?.hasKey && <>· saved ({d.keyHint})</>}
            </label>
            <Input type="password" autoComplete="off" placeholder="lk_live_..." value={key}
              onChange={(e) => setKey(e.target.value)} />
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Sync Mode: </span>
            <span className="rounded-full border border-border px-2 py-0.5 font-semibold">Live (Automatic on successful checkout)</span>
          </div>
          {d?.lastError && <p className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">Last error: {d.lastError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onSave} disabled={!!busy}>
              {busy === "save" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save Settings
            </Button>
            <Button size="sm" variant="outline" onClick={onTest} disabled={!!busy || !d?.hasKey}>
              {busy === "test" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Test Connection
            </Button>
          </div>
        </div>
      )}
    </AdminSection>
  );
}
