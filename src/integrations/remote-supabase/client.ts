// Remote Supabase project: dawcdietltejjxbdimkm
// Holds the canonical OG Bot tokens, persona content, and developer accounts.
// This client is intentionally SEPARATE from src/integrations/supabase/client.ts:
// - Different project = different JWT signer; sessions cannot be shared.
// - Distinct localStorage key so it never collides with the local session.
//
// Browser-only. Do NOT import from .server.ts files or createServerFn handlers.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const REMOTE_SUPABASE_URL = "https://dawcdietltejjxbdimkm.supabase.co";
export const REMOTE_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhd2NkaWV0bHRlamp4YmRpbWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTcyODYsImV4cCI6MjA5MzgzMzI4Nn0.evNy8qk5a3MLZxJRSUOTNfKbkeqhbgxVVfJWxqY7BPA";

export const remoteSupabase: SupabaseClient = createClient(
  REMOTE_SUPABASE_URL,
  REMOTE_SUPABASE_ANON_KEY,
  {
    auth: {
      storageKey: "sb-remote-ogbot-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);
