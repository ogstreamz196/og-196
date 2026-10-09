import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Loader2, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminSection } from "./AdminSection";
import {
  addVaultCredential,
  deleteVaultCredential,
  getVaultWebhookSettings,
  listVaultCredentials,
  resyncVaultWebhook,
  saveVaultWebhookSettings,
  setVaultCredentialActive,
  testVaultWebhook,
} from "@/lib/vault.functions";
import { buildVaultReceiverPrompt } from "@/lib/vault-prompt";

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("en-GB") : "Never");
const copy = (text: string, label: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Couldn't copy — long-press to select instead"),
  );
const hookToast = (h?: { ok: boolean; message: string }) => {
  if (h && !h.ok && h.message !== "Webhook is switched off" && !h.message.startsWith("Add a target"))
    toast.warning(`Saved, but your other app wasn't told: ${h.message}`);
};

export function VaultWebhookPanel() {
  const qc = useQueryClient();
  const getSettings = useServerFn(getVaultWebhookSettings);
  const saveSettings = useServerFn(saveVaultWebhookSettings);
  const test = useServerFn(testVaultWebhook);
  const resync = useServerFn(resyncVaultWebhook);
  const list = useServerFn(listVaultCredentials);
  const add = useServerFn(addVaultCredential);
  const setActive = useServerFn(setVaultCredentialActive);
  const del = useServerFn(deleteVaultCredential);

  const s = useQuery({ queryKey: ["vault-webhook"], queryFn: () => getSettings() });
  const creds = useQuery({ queryKey: ["vault-creds"], queryFn: () => list() });
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ username: "", password: "", note: "" });
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (s.data) { setEnabled(s.data.enabled); setUrl(s.data.targetUrl); }
  }, [s.data]);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["vault-webhook"] });
    qc.invalidateQueries({ queryKey: ["vault-creds"] });
  };
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(null); refresh(); }
  };

  const [showKey, setShowKey] = useState(false);
  const prompt = useMemo(() => buildVaultReceiverPrompt(origin || "https://ogbot.co.uk"), [origin]);
  const fullPrompt = s.data?.secret
    ? `${prompt}\n\nThe OG_VAULT_WEBHOOK_SECRET value to save in the secure secret form is:\n${s.data.secret}`
    : prompt;
  const d = s.data;
  const status = !d?.targetUrl ? "Not set up" : d.lastTestOk === false || d.lastError ? "Error" : d.lastTestOk ? "Connected" : "Not tested";
  const badge = status === "Connected" ? "bg-primary/15 text-primary" : status === "Error" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-4">
      <AdminSection
        icon={<KeyRound className="h-5 w-5 text-primary" />}
        title="OG Vault logins"
        subtitle="Logins shown to Vault pass owners. Adding, switching off or removing one tells your other app straight away."
      >
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input placeholder="Username / ID" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <Input placeholder="PIN / password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Input placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <Button size="sm" disabled={!!busy || !form.username || !form.password}
              onClick={() => run("add", async () => {
                const r = await add({ data: form });
                toast.success("Login added");
                hookToast(r.hook);
                setForm({ username: "", password: "", note: "" });
              })}>
              {busy === "add" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Add login
            </Button>
          </div>
          {creds.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(creds.data ?? []).length === 0 && <li className="p-3 text-xs text-muted-foreground">No logins yet.</li>}
              {(creds.data ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 p-2.5 text-sm">
                  <span className="min-w-0 flex-1 break-all font-mono">
                    {c.username} · {c.password}
                    {c.note && <span className="ml-2 text-xs text-muted-foreground">{c.note}</span>}
                  </span>
                  <Switch checked={c.active} disabled={!!busy}
                    onCheckedChange={(v) => run(`a-${c.id}`, async () => hookToast((await setActive({ data: { id: c.id, active: v } })).hook))} />
                  <Button size="icon" variant="ghost" aria-label={`Remove ${c.username}`} disabled={!!busy}
                    onClick={() => run(`d-${c.id}`, async () => { hookToast((await del({ data: { id: c.id } })).hook); toast.success("Login removed"); })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AdminSection>

      <AdminSection
        icon={<Webhook className="h-5 w-5 text-primary" />}
        title="OG Vault webhook"
        subtitle="Sends Vault logins to your other app so it knows which ones to accept."
        action={<span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge}`}>{status}</span>}
      >
        {s.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">Send changes to my other app</span>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </label>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Your other app's receiving address</label>
              <Input placeholder="https://your-other-app.com/api/public/og-vault" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            {d?.secret && (
              <div className="space-y-1.5 rounded-md border border-primary/40 bg-primary/5 p-3">
                <p className="text-sm font-bold">Your OG Vault API key</p>
                <p className="text-xs text-muted-foreground">Made by this app. It's already inside the copied prompt — your other app saves it as OG_VAULT_WEBHOOK_SECRET.</p>
                <div className="flex gap-2">
                  <Input readOnly type={showKey ? "text" : "password"} value={d.secret} className="font-mono text-xs" />
                  <Button size="sm" variant="ghost" onClick={() => setShowKey((v) => !v)}>{showKey ? "Hide" : "Show"}</Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(d.secret, "API key")}>
                    <Copy className="h-4 w-4" />Copy
                  </Button>
                </div>
              </div>
            )}
            <div className="grid gap-1 text-xs">
              <div><span className="text-muted-foreground">Last test: </span>{fmt(d?.lastTestAt ?? null)}</div>
              <div><span className="text-muted-foreground">Last change sent: </span>{fmt(d?.lastSentAt ?? null)}</div>
            </div>
            {d?.lastError && <p className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">Last problem: {d.lastError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!!busy} onClick={() => run("save", async () => { await saveSettings({ data: { enabled, targetUrl: url } }); toast.success("Webhook saved"); })}>
                {busy === "save" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy || !d?.targetUrl} onClick={() => run("test", async () => { const r = await test(); r.ok ? toast.success(r.message) : toast.error(r.message); })}>
                {busy === "test" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Test ping
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy || !d?.targetUrl} onClick={() => run("resync", async () => { const r = await resync(); r.ok ? toast.success(r.message) : toast.error(r.message); })}>
                {busy === "resync" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Send all logins
              </Button>
              {d?.secret && (
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("regen", async () => { await saveSettings({ data: { enabled, targetUrl: url, regenerateSecret: true } }); toast.success("New secret made — update your other app"); })}>
                  New secret
                </Button>
              )}
            </div>

            <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">Prompt for your other Lovable project</p>
                <Button size="sm" className="gap-1.5" onClick={() => copy(prompt, "Prompt")}>
                  <Copy className="h-4 w-4" />Copy prompt
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                1. Copy the secret above. 2. Paste this prompt into the other project and give it the secret when asked. 3. It adds an OG Vault API card in its Boss Controls → VIP users section showing its receiving address — paste that into the box above, Save, then Test ping. Both sides then show Verified. Moving either app to another workspace or domain won't break it.
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2 text-[11px] leading-relaxed">{prompt}</pre>
            </div>
          </div>
        )}
      </AdminSection>
    </div>
  );
}
