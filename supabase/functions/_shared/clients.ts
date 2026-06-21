// Shared Supabase client factories for edge functions.
// - adminClient(): service-role; RLS bypassed. Use only for trusted writes.
// - userClient(req): publishable key + caller bearer; RLS applies as the user.
// - requireUser(req): resolves the authenticated user or returns a 401 Response.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "./cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLISHABLE =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE);
}

export function userClient(req: Request): SupabaseClient | null {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  return createClient(SUPABASE_URL, PUBLISHABLE, {
    global: { headers: { Authorization: auth } },
  });
}

export async function requireUser(
  req: Request,
): Promise<{ user: { id: string }; error: null } | { user: null; error: Response }> {
  const client = userClient(req);
  if (!client) return { user: null, error: jsonResponse({ error: "Missing auth" }, 401) };
  const { data } = await client.auth.getUser();
  if (!data.user) return { user: null, error: jsonResponse({ error: "Unauthorized" }, 401) };
  return { user: data.user, error: null };
}
