import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Flame, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const REMOTE_SUPABASE_URL = "https://dawcdietltejjxbdimkm.supabase.co";
const REMOTE_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhd2NkaWV0bHRlamp4YmRpbWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTcyODYsImV4cCI6MjA5MzgzMzI4Nn0.evNy8qk5a3MLZxJRSUOTNfKbkeqhbgxVVfJWxqY7BPA";

const remote = createClient(REMOTE_SUPABASE_URL, REMOTE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Introspection = {
  ok: boolean;
  reason?: string | null;
  expires_at?: string | null;
  scopes?: unknown;
  policy?: unknown;
  uses_remaining?: number | null;
  grants_vip?: boolean | null;
  bound_external_user?: string | null;
  domains?: string[] | null;
};

type BurnResult = {
  ok: boolean;
  reason?: string | null;
  uses_remaining?: number | null;
  grants_vip?: boolean | null;
  expires_at?: string | null;
  burnt?: boolean | null;
};

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return toHex(sig);
}

export function RemoteTokenInspector() {
  const [token, setToken] = useState("");
  const [origin, setOrigin] = useState(
    typeof window !== "undefined" ? window.location.hostname : "",
  );
  const [externalUser, setExternalUser] = useState("");

  const [introspecting, setIntrospecting] = useState(false);
  const [burning, setBurning] = useState(false);
  const [introspection, setIntrospection] = useState<Introspection | null>(null);
  const [lastBurn, setLastBurn] = useState<BurnResult | null>(null);

  const tokenTrim = token.trim();
  const originTrim = origin.trim();

  const canIntrospect = useMemo(
    () => tokenTrim.length > 0 && originTrim.length > 0 && !introspecting,
    [tokenTrim, originTrim, introspecting],
  );
  const canBurn = useMemo(
    () =>
      tokenTrim.length > 0 &&
      originTrim.length > 0 &&
      externalUser.trim().length > 0 &&
      !burning &&
      introspection?.ok === true,
    [tokenTrim, originTrim, externalUser, burning, introspection],
  );

  async function handleIntrospect() {
    setIntrospecting(true);
    setLastBurn(null);
    setIntrospection(null);
    try {
      const { data, error } = await remote.rpc("og_bot_token_introspect", {
        _token: tokenTrim,
        _origin_host: originTrim,
      });
      if (error) throw error;
      const result = (data ?? {}) as Introspection;
      setIntrospection(result);
      if (result.ok) toast.success("Token is valid for this origin.");
      else toast.error(`Invalid token: ${result.reason ?? "unknown"}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Introspect failed: ${msg}`);
    } finally {
      setIntrospecting(false);
    }
  }

  async function handleBurn() {
    if (!confirm("Burn one use of this token? This is irreversible.")) return;
    setBurning(true);
    setLastBurn(null);
    try {
      const ts = Math.floor(Date.now() / 1000);
      const nonce = crypto.randomUUID();
      const ext = externalUser.trim();
      const message = `${tokenTrim}|${originTrim}|${ext}|${nonce}|${ts}`;
      const signature = await hmacSha256Hex(tokenTrim, message);

      const { data, error } = await remote.rpc("og_bot_token_burn", {
        _token: tokenTrim,
        _origin_host: originTrim,
        _external_user: ext,
        _nonce: nonce,
        _ts_unix: ts,
        _signature: signature,
      });
      if (error) throw error;
      const result = (data ?? {}) as BurnResult;
      setLastBurn(result);
      if (result.ok && result.burnt) toast.success("Burned one use.");
      else if (result.ok) toast.message(result.reason ?? "Burn reported ok=true but burnt=false.");
      else toast.error(`Burn rejected: ${result.reason ?? "unknown"}`);

      // Refresh introspection to reflect new uses_remaining
      void handleIntrospect();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Burn failed: ${msg}`);
    } finally {
      setBurning(false);
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Remote token inspector</h3>
        <Badge variant="outline" className="text-[10px]">
          dawcdietltejjxbdimkm
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste an OG Bot token issued by the mother project. Validates against{" "}
        <code className="text-xs">og_bot_token_introspect</code> and can burn one use via{" "}
        <code className="text-xs">og_bot_token_burn</code>.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="rti-token" className="text-xs">Token</Label>
          <Input
            id="rti-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ogb_..."
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rti-origin" className="text-xs">Origin host</Label>
          <Input
            id="rti-origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="example.com"
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rti-ext" className="text-xs">External user (for burn)</Label>
          <Input
            id="rti-ext"
            value={externalUser}
            onChange={(e) => setExternalUser(e.target.value)}
            placeholder="user_id / email / handle"
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleIntrospect} disabled={!canIntrospect}>
          {introspecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Validate
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleBurn}
          disabled={!canBurn}
          title={!introspection?.ok ? "Validate first" : "Burn one use"}
        >
          {burning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Flame className="mr-2 h-4 w-4" />
          )}
          Burn one use
        </Button>
      </div>

      {introspection && (
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium">
            {introspection.ok ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Valid
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 text-destructive" /> Invalid
                {introspection.reason && (
                  <span className="text-xs font-normal text-muted-foreground">
                    — {introspection.reason}
                  </span>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <Stat label="Uses remaining" value={fmt(introspection.uses_remaining)} />
            <Stat label="Expires" value={fmtDate(introspection.expires_at)} />
            <Stat label="Grants VIP" value={fmtBool(introspection.grants_vip)} />
            <Stat
              label="Bound user"
              value={introspection.bound_external_user ?? "—"}
              mono
            />
            <Stat
              label="Domains"
              value={
                Array.isArray(introspection.domains) && introspection.domains.length
                  ? introspection.domains.join(", ")
                  : "—"
              }
            />
          </div>
          {Boolean(introspection.scopes || introspection.policy) && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">scopes / policy</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-[11px]">
{JSON.stringify({ scopes: introspection.scopes, policy: introspection.policy }, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {lastBurn && (
        <div className="rounded-lg border p-3 space-y-1 bg-muted/30">
          <div className="text-xs font-medium">Last burn</div>
          <pre className="overflow-x-auto rounded bg-background p-2 text-[11px]">
{JSON.stringify(lastBurn, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : "text-xs"}>{value}</div>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "∞";
  return String(v);
}
function fmtBool(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v ? "yes" : "no";
}
function fmtDate(v: string | null | undefined): string {
  if (!v) return "never";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}
