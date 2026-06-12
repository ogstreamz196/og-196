import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  introspectOgBotToken,
  listMyOgBotTokens,
  mintOgBotToken,
  revokeOgBotToken,
  type Introspection,
  type MintedToken,
} from "@/lib/og-bot-remote.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SongStudioCoPilot } from "@/components/messenger/SongStudioCoPilot";
import { Bot, Coins, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/og-bot/connect")({
  component: ConnectPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">
      OG Bot threw a tantrum: {String(error?.message ?? error)}
    </div>
  ),
});

function ConnectPage() {
  const mintFn = useServerFn(mintOgBotToken);
  const listFn = useServerFn(listMyOgBotTokens);
  const revokeFn = useServerFn(revokeOgBotToken);
  const introspectFn = useServerFn(introspectOgBotToken);
  const qc = useQueryClient();

  const [validateToken, setValidateToken] = useState("");
  const [validateOrigin, setValidateOrigin] = useState("");
  const [introspection, setIntrospection] = useState<Introspection | null>(null);

  const introspectMut = useMutation({
    mutationFn: () =>
      introspectFn({
        data: {
          token: validateToken.trim(),
          originHost: validateOrigin.trim(),
        },
      }),
    onSuccess: (data) => {
      setIntrospection(data);
      if (data.ok) toast.success("Token is valid for this origin.");
      else toast.error(`Invalid: ${data.reason ?? "unknown"}`);
    },
    onError: (e: unknown) => {
      setIntrospection(null);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.length > 300 ? msg.slice(0, 300) + "…" : msg);
    },
  });

  const [originHost, setOriginHost] = useState("");
  const [externalUser, setExternalUser] = useState("");
  const [uses, setUses] = useState("");
  const [grantsVip, setGrantsVip] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [revealed, setRevealed] = useState<MintedToken | null>(null);

  const tokensQ = useQuery({
    queryKey: ["og-bot-remote-tokens"],
    queryFn: () => listFn(),
  });

  const mintMut = useMutation({
    mutationFn: () =>
      mintFn({
        data: {
          originHost: originHost.trim(),
          externalUser: externalUser.trim() || undefined,
          usesRemaining: uses ? Number(uses) : undefined,
          grantsVip: grantsVip || undefined,
          expiresAt: expiresAt
            ? new Date(expiresAt).toISOString()
            : undefined,
        },
      }),
    onSuccess: (data) => {
      setRevealed(data);
      toast.success("Token minted. Copy it, don't cry about it.");
      qc.invalidateQueries({ queryKey: ["og-bot-remote-tokens"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Revoked. It's a brick now.");
      qc.invalidateQueries({ queryKey: ["og-bot-remote-tokens"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Plug into OG Bot.
        </h1>
        <p className="text-muted-foreground">
          One token. One domain. Don't share it, don't lose it, don't paste it
          on Discord you absolute melt.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Mint a token</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!originHost.trim()) {
                toast.error("Origin host is required, genius.");
                return;
              }
              setRevealed(null);
              mintMut.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="originHost">Origin host *</Label>
              <Input
                id="originHost"
                placeholder="ocsportal.co.uk"
                value={originHost}
                onChange={(e) => setOriginHost(e.target.value)}
                required
                maxLength={253}
              />
              <p className="text-xs text-muted-foreground">
                Must already be on the mothership whitelist or mint will tell
                you to get bent.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalUser">External user (optional)</Label>
              <Input
                id="externalUser"
                placeholder="user-id or email"
                value={externalUser}
                onChange={(e) => setExternalUser(e.target.value)}
                maxLength={256}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="uses">Uses (blank = unlimited)</Label>
                <Input
                  id="uses"
                  type="number"
                  min={1}
                  max={1000000}
                  value={uses}
                  onChange={(e) => setUses(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires at (optional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="grantsVip"
                checked={grantsVip}
                onCheckedChange={(v) => setGrantsVip(v === true)}
              />
              <Label htmlFor="grantsVip" className="cursor-pointer">
                Grants VIP
              </Label>
            </div>

            <Button type="submit" disabled={mintMut.isPending}>
              {mintMut.isPending ? "Minting…" : "Mint token"}
            </Button>
          </form>

          {revealed && (
            <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <p className="mb-2 text-sm font-medium text-destructive">
                Copy it now. I'm not showing it again. Lose it = mint a new
                one, genius.
              </p>
              <pre className="overflow-auto rounded bg-muted p-3 text-xs">
                {revealed.token}
              </pre>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  expires: {revealed.expires_at ?? "never"}
                </span>
                <span>
                  uses: {revealed.uses_remaining ?? "unlimited"}
                </span>
                <span>VIP: {revealed.grants_vip ? "yes" : "no"}</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  navigator.clipboard.writeText(revealed.token);
                  toast.success("Copied. Don't fumble it.");
                }}
              >
                Copy token
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validate any token</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validateToken.trim() || !validateOrigin.trim()) {
                toast.error("Need both a token and an origin host.");
                return;
              }
              setIntrospection(null);
              introspectMut.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="vToken">Token</Label>
              <Input
                id="vToken"
                placeholder="ogb_…"
                value={validateToken}
                onChange={(e) => setValidateToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vOrigin">Origin host</Label>
              <Input
                id="vOrigin"
                placeholder="ocsportal.co.uk"
                value={validateOrigin}
                onChange={(e) => setValidateOrigin(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
            </div>
            <Button type="submit" disabled={introspectMut.isPending}>
              {introspectMut.isPending ? "Checking…" : "Validate"}
            </Button>
          </form>

          {introspection && (
            <div className="mt-4 rounded-md border p-3 text-xs space-y-1">
              <div className="font-medium">
                {introspection.ok ? "✅ Valid" : `❌ Invalid — ${introspection.reason ?? "unknown"}`}
              </div>
              <div>uses_remaining: {introspection.uses_remaining ?? "∞"}</div>
              <div>expires_at: {introspection.expires_at ?? "never"}</div>
              <div>grants_vip: {introspection.grants_vip ? "yes" : "no"}</div>
              <div>bound_external_user: {introspection.bound_external_user ?? "—"}</div>
              {Array.isArray(introspection.domains) && (
                <div>domains: {introspection.domains.join(", ") || "—"}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {tokensQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tokensQ.error ? (
            <p className="text-sm text-destructive">
              {String((tokensQ.error as Error).message)}
            </p>
          ) : !tokensQ.data?.length ? (
            <p className="text-sm text-muted-foreground">
              No tokens yet. Mint one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>VIP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokensQ.data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">
                      {t.origin_host}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.external_user ?? "—"}
                    </TableCell>
                    <TableCell>{t.uses_remaining ?? "∞"}</TableCell>
                    <TableCell className="text-xs">
                      {t.expires_at
                        ? new Date(t.expires_at).toLocaleString()
                        : "never"}
                    </TableCell>
                    <TableCell>{t.grants_vip ? "✓" : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {t.revoked_at ? (
                        <span className="text-destructive">revoked</span>
                      ) : (
                        <span className="text-emerald-600">active</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!t.revoked_at && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={revokeMut.isPending}
                          onClick={() => revokeMut.mutate(t.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
