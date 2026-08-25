import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { ExternalLink, KeyRound, ShieldCheck, AlertTriangle } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/api-keys")({
  component: AdminApiKeysPage,
});

export function AdminApiKeysPage() {
  const { isAdmin, isDev, isLoading } = useRole();
  if (isLoading) return null;
  if (!isAdmin && !isDev) return <Navigate to="/" />;

  return (
    <DashboardShell title="API Keys & Secrets">
      <div className="max-w-3xl mx-auto space-y-6 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/admin" className="hover:underline">← Back to Admin</Link>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-100/90">
            <p className="font-medium mb-1">Secrets cannot be edited from the app.</p>
            <p>
              Edge Function secrets (like <code className="bg-black/30 px-1 rounded">SUNO_API_KEY</code>) live in
              Lovable Cloud's encrypted secret store. They are rotated through the Lovable editor's secure prompt —
              never via a runtime form, which would be a security hole.
            </p>
          </div>
        </div>

        <section className="rounded-xl border border-border bg-card/40 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Suno API Key</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Used by the <code className="bg-black/30 px-1 rounded">suno-generate</code> and
            <code className="bg-black/30 px-1 rounded"> suno-callback</code> Edge Functions to generate songs.
            If generation fails with 401, the key is expired or out of credits.
          </p>

          <ol className="text-sm space-y-2 list-decimal list-inside text-foreground/90">
            <li>Open the Suno API provider dashboard and generate / copy a new key.</li>
            <li>Top up credits if the balance is empty.</li>
            <li>In Lovable chat, say <em>"update my SUNO_API_KEY"</em>. A secure prompt opens — paste the key there.</li>
          </ol>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild variant="default">
              <a href="https://sunoapi.org" target="_blank" rel="noopener noreferrer">
                Open sunoapi.org <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            {isDev && (
              <Button asChild variant="outline">
                <a href="https://sunoapi.org/dashboard" target="_blank" rel="noopener noreferrer">
                  Dev dashboard <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card/40 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">Why no in-app form?</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            An admin form that writes API keys at runtime would mean a compromised admin session could silently swap
            your backend credentials. The Lovable secret prompt is out-of-band: only the workspace owner can paste
            into it, and the value is encrypted at rest.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
