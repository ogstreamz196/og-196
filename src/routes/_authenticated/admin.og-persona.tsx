import { createFileRoute, Navigate, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bot, Loader2, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSiteContent, useSetSiteContent } from "@/hooks/use-site-content";
import { toast } from "sonner";

const DEFAULT_SCRIPT =
  "You are OG Bot, the in-house messenger and concierge for the Sonix AI music platform. " +
  "Be friendly, hype, and helpful. Keep replies short (1–4 sentences), use line breaks, and answer like a real person. " +
  "Help users with song generation, coins, portals, VIP perks, and account questions.";
const DEFAULT_VOICE =
  "Confident, warm, slightly playful. Hype-man energy without being cringey. Lower-case is fine. No emojis spam — at most one per reply.";
const DEFAULT_DICTIONARY =
  "OG = original gangster / the boss; Sonix = the platform; coins = generation credits; portal = curated theme; VIP = paid tier; drop = release a song; cooked = generated; vibe = mood/style.";

export const Route = createFileRoute("/_authenticated/admin/og-persona")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: OgPersonaPage,
});

function OgPersonaPage() {
  const { isAdmin, isLoading } = useRole();
  const { get, isLoading: loadingContent } = useSiteContent();
  const setContent = useSetSiteContent();

  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("");
  const [dictionary, setDictionary] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loadingContent) return;
    setScript(get("og_persona.script", DEFAULT_SCRIPT));
    setVoice(get("og_persona.voice", DEFAULT_VOICE));
    setDictionary(get("og_persona.dictionary", DEFAULT_DICTIONARY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingContent]);

  if (isLoading) {
    return (
      <DashboardShell title="OG Bot Persona">
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  async function saveAll() {
    setSaving(true);
    try {
      await Promise.all([
        setContent.mutateAsync({ key: "og_persona.script", value: script }),
        setContent.mutateAsync({ key: "og_persona.voice", value: voice }),
        setContent.mutateAsync({ key: "og_persona.dictionary", value: dictionary }),
      ]);
      toast.success("OG Bot persona updated. New messages will use it instantly.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell title="OG Bot Persona">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/admin/og-bot" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to OG Bot tokens
        </Link>

        <div className="rounded-xl border border-primary/30 bg-gradient-brand-soft p-5">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Boss only</span>
          </div>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-bold">
            <Bot className="h-5 w-5 text-primary" /> OG Messenger Persona
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Script, voice, and dictionary control how OG Bot talks site-wide — synced to the OG Messenger page and the bottom-right widget for every user.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="og-script">Script (system prompt)</Label>
          <Textarea id="og-script" rows={8} value={script} onChange={(e) => setScript(e.target.value)} maxLength={5000} />
          <p className="text-xs text-muted-foreground">Core instructions, role, and goals.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="og-voice">Voice</Label>
          <Textarea id="og-voice" rows={4} value={voice} onChange={(e) => setVoice(e.target.value)} maxLength={5000} />
          <p className="text-xs text-muted-foreground">Tone, energy, and style rules.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="og-dict">Dictionary / Slang</Label>
          <Textarea id="og-dict" rows={6} value={dictionary} onChange={(e) => setDictionary(e.target.value)} maxLength={5000} />
          <p className="text-xs text-muted-foreground">Vocabulary and slang the bot should naturally use.</p>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save persona
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
