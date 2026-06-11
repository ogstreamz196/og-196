import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Code2, Coins, Copy, Check, Eye, EyeOff, Globe, Loader2, Plus, Power, PowerOff, ShieldCheck, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/developer")({
  component: DeveloperCenter,
});

const TOKEN_COST = 25;
const WIDGET_CDN = "https://cdn.ogstreamz.co.uk/widget.js";

interface BotToken {
  id: string;
  token_string: string;
  status: string;
  allowed_domain: string | null;
  created_at: string;
}

function mask(token: string) {
  if (token.length < 12) return token;
  return `${token.slice(0, 8)}${"•".repeat(10)}${token.slice(-4)}`;
}

function DeveloperCenter() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const balance = profile?.coin_balance ?? 0;

  const tokensQ = useQuery({
    queryKey: ["bot-tokens", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BotToken[]> => {
      const { data, error } = await supabase
        .from("bot_tokens")
        .select("id, token_string, status, allowed_domain, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BotToken[];
    },
  });

  const purchase = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("purchase_bot_token", {});
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("New OG Bot token minted!");
      qc.invalidateQueries({ queryKey: ["bot-tokens"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => {
      const msg = e.message.includes("insufficient_coins")
        ? `You need ${TOKEN_COST} coins to purchase a token.`
        : e.message;
      toast.error(msg);
    },
  });

  return (
    <DashboardShell title="Developer Center">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-8 shadow-card backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            B2B Developer Marketplace
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Run the <span className="text-gradient-brand">OG Bot</span> on your own codebase
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Purchase license tokens, bind them to your domain, and embed the floating widget on your sites.
            Each token costs <span className="font-semibold text-foreground">{TOKEN_COST} OG coins</span>.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="gap-2"
              onClick={() => purchase.mutate()}
              disabled={purchase.isPending || balance < TOKEN_COST}
            >
              {purchase.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Purchase New OG Bot Token
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1.5 text-sm">
              <Coins className="h-4 w-4 text-coin" />
              <span className="tabular-nums">{balance}</span>
              <span className="text-muted-foreground">balance</span>
            </div>
            {balance < TOKEN_COST && (
              <span className="text-xs text-muted-foreground">
                Need {TOKEN_COST - balance} more coins — top up to purchase.
              </span>
            )}
          </div>
        </div>

        {/* Tokens list */}
        <section>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Code2 className="h-5 w-5 text-primary" />
            Your Active Tokens
          </h3>

          {tokensQ.isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !tokensQ.data || tokensQ.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground backdrop-blur">
              No tokens yet. Purchase your first OG Bot token above to get started.
            </div>
          ) : (
            <div className="grid gap-4">
              {tokensQ.data.map((t) => (
                <TokenCard key={t.id} token={t} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

function TokenCard({ token }: { token: BotToken }) {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [domain, setDomain] = useState(token.allowed_domain ?? "");
  const [saving, setSaving] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const isSuspended = token.status !== "active";

  const snippet = `<script src="${WIDGET_CDN}" data-og-token="${token.token_string}"></script>`;

  async function toggleSuspend() {
    setSuspending(true);
    const nextStatus = isSuspended ? "active" : "suspended";
    const { error } = await supabase
      .from("bot_tokens")
      .update({ status: nextStatus })
      .eq("id", token.id);
    setSuspending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      nextStatus === "suspended"
        ? "Token suspended — widget & OG Messenger will hide on next check"
        : "Token reactivated",
    );
    qc.invalidateQueries({ queryKey: ["bot-tokens"] });
  }

  async function saveDomain() {
    const trimmed = domain.trim();
    if (trimmed && !/^https?:\/\/.+/i.test(trimmed)) {
      toast.error("Domain must start with http:// or https://");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("bot_tokens")
      .update({ allowed_domain: trimmed || null })
      .eq("id", token.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Domain binding updated");
    qc.invalidateQueries({ queryKey: ["bot-tokens"] });
  }

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-card backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <code className="rounded-md bg-background/60 px-2 py-1 font-mono text-xs">
                {revealed ? token.token_string : mask(token.token_string)}
              </code>
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
                aria-label={revealed ? "Hide token" : "Reveal token"}
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Created {new Date(token.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium " +
              (token.status === "active"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : "border-amber-500/40 bg-amber-500/10 text-amber-500")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {token.status}
          </span>
          <Button
            size="sm"
            variant={isSuspended ? "default" : "outline"}
            onClick={toggleSuspend}
            disabled={suspending}
            className="gap-1.5"
          >
            {suspending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isSuspended ? (
              <Power className="h-3.5 w-3.5" />
            ) : (
              <PowerOff className="h-3.5 w-3.5" />
            )}
            {isSuspended ? "Reactivate" : "Suspend"}
          </Button>
        </div>
      </div>

      {isSuspended && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          This token is suspended. The OG Bot widget and OG Messenger will deny access
          and hide themselves on every site using this token until you reactivate it.
        </div>
      )}

      {/* Domain binding */}
      <div className="mt-5">
        <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Allowed domain
        </label>
        <div className="flex gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="https://myawesomecodebase.com"
            className="bg-background/60"
          />
          <Button onClick={saveDomain} disabled={saving} variant="secondary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The widget will only initialize on requests originating from this domain.
        </p>
      </div>

      {/* Snippet */}
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Integration snippet</span>
          <button
            type="button"
            onClick={copySnippet}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs font-medium transition hover:border-primary/40 hover:text-primary"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy Snippet
              </>
            )}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-border bg-background/70 p-3 text-xs">
          <code className="font-mono text-foreground/90">{snippet}</code>
        </pre>
      </div>
    </div>
  );
}
