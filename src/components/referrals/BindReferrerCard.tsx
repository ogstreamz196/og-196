import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Search, Lock, CheckCircle2, Skull } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractReferrerId(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (UUID_RE.test(t)) return t.toLowerCase();
  // accept full link forms like https://ogstreamz.co.uk/r/<uuid>
  const m = t.match(/\/r\/([0-9a-f-]{36})/i);
  return m ? m[1].toLowerCase() : null;
}

export function BindReferrerCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [lookup, setLookup] = useState<{ id: string; name: string } | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  const mineQ = useQuery({
    queryKey: ["my-referrer", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_referrer");
      if (error) throw error;
      return data as { has_referrer: boolean; referrer_id?: string; referrer_name?: string };
    },
  });

  useEffect(() => { setAck(false); }, [lookup?.id]);

  if (mineQ.isLoading) return null;

  if (mineQ.data?.has_referrer) {
    return (
      <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 text-emerald-400" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-emerald-300">
              Locked to your referrer for life
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{mineQ.data.referrer_name}</span> now
              owns your life in their hands. They earn 10% of every OG Coin you burn — forever. This
              bond can never be changed.
            </div>
          </div>
        </div>
      </section>
    );
  }

  const lookupReferrer = async () => {
    const id = extractReferrerId(input);
    if (!id) {
      toast.error("Paste a valid OG referral link or ID");
      return;
    }
    if (user && id === user.id) {
      toast.error("You can't refer yourself");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("lookup_referrer", { p_referrer: id });
      if (error) throw error;
      const r = data as { found: boolean; referrer_id?: string; referrer_name?: string };
      if (!r.found) { toast.error("Referrer not found"); setLookup(null); return; }
      setLookup({ id: r.referrer_id!, name: r.referrer_name! });
    } catch (e: any) {
      toast.error(e?.message ?? "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  const bind = async () => {
    if (!lookup || !ack) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("claim_referrer_permanent", {
        p_referrer: lookup.id,
        p_acknowledged: true,
      });
      if (error) throw error;
      toast.success(`Bound to ${lookup.name} — forever.`);
      qc.invalidateQueries({ queryKey: ["my-referrer", user?.id] });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("already_has_referrer")) toast.error("You already have a referrer");
      else toast.error(msg || "Could not bind referrer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-card/70 p-5 backdrop-blur-xl sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <Skull className="h-5 w-5 text-rose-400" />
        <h2 className="font-display text-lg font-bold">Bind your referrer (one-time, forever)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Paste the OG link or ID of the person who brought you in. Once locked, 10% of every OG Coin
        you ever burn goes to their OG Vault — automatically, for life. You can only do this once.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={input}
          onChange={(e) => { setInput(e.target.value); setLookup(null); }}
          placeholder="https://ogstreamz.co.uk/r/… or referrer ID"
          className="flex-1"
        />
        <Button onClick={lookupReferrer} disabled={busy || !input.trim()} variant="secondary" className="gap-2">
          <Search className="h-4 w-4" /> Find
        </Button>
      </div>

      {lookup && (
        <div className="mt-4 space-y-3 rounded-2xl border border-rose-500/40 bg-rose-500/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
            <div className="text-sm">
              <div className="font-semibold text-rose-300">Heavy warning — read carefully</div>
              <p className="mt-1 text-muted-foreground">
                You're about to hand{" "}
                <span className="font-semibold text-foreground">{lookup.name}</span> the keys.
                They now own your life in their hands — they can rinse you completely.{" "}
                <span className="font-semibold text-foreground">10% of every OG Coin</span> you burn
                from this moment on flows into <span className="font-semibold">{lookup.name}'s</span>{" "}
                OG Vault. This decision is permanent. It cannot be undone, swapped, or reset by anyone,
                ever.
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-background/40 p-3 text-sm">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
            <span>
              I understand. {lookup.name} now owns my life in their hands and earns 10% of every OG
              Coin I burn — forever.
            </span>
          </label>

          <Button onClick={bind} disabled={!ack || busy} className="w-full gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Lock {lookup.name} as my referrer — forever
          </Button>
        </div>
      )}
    </section>
  );
}
