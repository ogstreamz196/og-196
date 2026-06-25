import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Bell, BellOff, RefreshCw, Send, Sheet, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getBossNotifPrefs,
  updateBossNotifPrefs,
  sendTestBossNotification,
} from "@/lib/sign-in-tracking.functions";
import {
  getSheetsConfig,
  setSheetsConfig,
  resyncAllProfilesNow,
} from "@/lib/sheets-sync.functions";

type Prefs = Awaited<ReturnType<typeof getBossNotifPrefs>>;

export function BossNotificationsPanel() {
  const qc = useQueryClient();
  const { data: prefs, isLoading } = useQuery<Prefs>({
    queryKey: ["boss-notif-prefs"],
    queryFn: () => getBossNotifPrefs(),
  });
  const { data: sheets } = useQuery({
    queryKey: ["sheets-config"],
    queryFn: () => getSheetsConfig(),
  });

  const [sheetId, setSheetId] = useState("");
  useEffect(() => {
    if (sheets?.sheetId) setSheetId(sheets.sheetId);
  }, [sheets?.sheetId]);

  const updateMut = useMutation({
    mutationFn: (data: Partial<NonNullable<Prefs>>) => updateBossNotifPrefs({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boss-notif-prefs"] }),
  });
  const testMut = useMutation({
    mutationFn: () => sendTestBossNotification(),
    onSuccess: (r) =>
      r.ok ? toast.success("Test sent to your Telegram") : toast.error(r.reason ?? "Failed"),
    onError: (e) => toast.error((e as Error).message),
  });
  const saveSheetMut = useMutation({
    mutationFn: () => setSheetsConfig({ data: { sheetId: sheetId.trim() } }),
    onSuccess: () => {
      toast.success("Spreadsheet ID saved");
      qc.invalidateQueries({ queryKey: ["sheets-config"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const resyncMut = useMutation({
    mutationFn: () => resyncAllProfilesNow({ data: undefined }),
    onSuccess: (r) =>
      r.ok ? toast.success(`Synced ${r.count} users to Sheets`) : toast.error(r.reason ?? "Failed"),
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !prefs) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading notification preferences…
      </div>
    );
  }

  const togglePref = (k: keyof NonNullable<Prefs>) => (val: boolean) => {
    updateMut.mutate({ [k]: val } as Partial<NonNullable<Prefs>>);
  };

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Boss notifications</h3>
          <p className="text-sm text-muted-foreground">
            Telegram DMs when users sign in. Defaults: signup + new device + new country.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => testMut.mutate()} disabled={testMut.isPending}>
          {testMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Send test DM
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PrefRow
          label="New signup"
          desc="DM when a brand-new account is created."
          icon={<Bell className="h-4 w-4 text-emerald-400" />}
          checked={prefs.notify_on_signup}
          onChange={togglePref("notify_on_signup")}
        />
        <PrefRow
          label="Every sign-in"
          desc="Noisy — DM on every successful login."
          icon={<Bell className="h-4 w-4 text-orange-400" />}
          checked={prefs.notify_every_signin}
          onChange={togglePref("notify_every_signin")}
        />
        <PrefRow
          label="New device"
          desc="DM when a known user signs in from a new device fingerprint."
          icon={<Bell className="h-4 w-4 text-sky-400" />}
          checked={prefs.notify_new_device}
          onChange={togglePref("notify_new_device")}
        />
        <PrefRow
          label="New country"
          desc="DM when a user's geo country changes."
          icon={<Bell className="h-4 w-4 text-violet-400" />}
          checked={prefs.notify_new_country}
          onChange={togglePref("notify_new_country")}
        />
        <PrefRow
          label="Suspicious activity"
          desc="DM on repeated failures, Tor/VPN, etc."
          icon={<BellOff className="h-4 w-4 text-rose-400" />}
          checked={prefs.notify_suspicious}
          onChange={togglePref("notify_suspicious")}
        />
        <PrefRow
          label="Google Sheets sync"
          desc="Mirror profiles to your Users sheet on every sign-in."
          icon={<Sheet className="h-4 w-4 text-emerald-300" />}
          checked={prefs.sheets_sync_enabled}
          onChange={togglePref("sheets_sync_enabled")}
        />
      </div>

      <div className="rounded-xl border border-dashed border-border/70 bg-background/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sheet className="h-4 w-4 text-emerald-300" />
          <h4 className="font-semibold">Users Sheet (Google)</h4>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Create a Google Sheet with a tab named <code className="rounded bg-card px-1">Users</code>, paste the
          spreadsheet ID from the URL (between <code>/d/</code> and <code>/edit</code>). Connector status:{" "}
          {sheets?.connectorPresent ? (
            <span className="text-emerald-400">connected</span>
          ) : (
            <span className="text-amber-400">missing GOOGLE_SHEETS_API_KEY</span>
          )}
          .
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grow">
            <Label className="text-xs">Spreadsheet ID</Label>
            <Input
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="1AbC...XYZ"
              className="font-mono text-xs"
            />
          </div>
          <Button
            onClick={() => saveSheetMut.mutate()}
            disabled={saveSheetMut.isPending || !sheetId.trim()}
            size="sm"
          >
            {saveSheetMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button
            variant="outline"
            onClick={() => resyncMut.mutate()}
            disabled={resyncMut.isPending || !sheets?.sheetId}
            size="sm"
          >
            {resyncMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Resync all
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrefRow({
  label,
  desc,
  icon,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition hover:bg-background/60">
      <div className="mt-0.5">{icon}</div>
      <div className="grow">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
