import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Minimal typed wrapper for the beta supabase.auth.oauth namespace so we don't
// depend on the SDK's public types surfacing it.
type AuthzDetails = {
  client?: { name?: string; redirect_uris?: string[] } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scopes?: string[] | null;
};
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
};
function oauth(): OAuthNs {
  return (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/welcome", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-lg p-6 text-white">
      <h1 className="text-2xl font-bold mb-3">Authorization error</h1>
      <p className="text-white/80">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "an external app";
  const scopes = details?.scopes ?? ["openid", "email", "profile"];

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto max-w-lg p-6 text-white">
      <h1 className="text-2xl font-bold mb-2">Connect {clientName} to OG Studio</h1>
      <p className="text-white/80 mb-4">
        This lets {clientName} use OG Studio as you — reading your profile, coin balance, and songs
        through the tools you've enabled.
      </p>
      <div className="rounded-lg border border-white/10 bg-black/30 p-4 mb-4">
        <p className="text-sm text-white/60 mb-2">Requested access</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {scopes.includes("profile") && <li>Share your basic profile</li>}
          {scopes.includes("email") && <li>Share your email address</li>}
          {scopes.filter((s: string) => !["openid", "email", "profile"].includes(s)).map((s: string) => (
            <li key={s}>Additional permission: {s}</li>
          ))}
        </ul>

        <p className="text-xs text-white/50 mt-3">
          This does not bypass OG Studio's permissions or backend policies.
        </p>
      </div>
      {error && <p role="alert" className="text-red-400 text-sm mb-3">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(true)}
          className="flex-1 rounded-md bg-red-600 hover:bg-red-500 px-4 py-2 font-semibold disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(false)}
          className="flex-1 rounded-md border border-white/20 px-4 py-2 disabled:opacity-50"
        >
          Cancel connection
        </button>
      </div>
    </main>
  );
}
