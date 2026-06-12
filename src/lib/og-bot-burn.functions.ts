// Burn one use of an OG Bot token issued by the main project.
//
// The token's signing_secret is stored server-side in og_bot_remote_tokens
// at mint time and never leaves this server. Callers pass only the token
// (and the external user it's being burnt for); we look up the secret,
// sign the burn payload, and call the main project's burn RPC directly.
//
// Origin host resolution (in order):
//   1. process.env.PUBLIC_HOST  (explicit override)
//   2. request Host header
//   3. origin_host recorded at mint time (fallback)
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";

const REMOTE_SUPABASE_URL = "https://dawcdietltejjxbdimkm.supabase.co";
const REMOTE_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhd2NkaWV0bHRlamp4YmRpbWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTcyODYsImV4cCI6MjA5MzgzMzI4Nn0.evNy8qk5a3MLZxJRSUOTNfKbkeqhbgxVVfJWxqY7BPA";

const InputSchema = z.object({
  token: z.string().min(8).max(200),
  externalUser: z.string().min(1).max(256),
});

export type BurnResult = {
  ok: boolean;
  reason: string | null;
  uses_remaining: number | null;
  grants_vip: boolean | null;
  expires_at: string | null;
  burnt: boolean;
};

export const burnOgBotToken = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<BurnResult> => {
    // Look up the signing secret server-side. Service-role bypasses RLS;
    // this module is client-safe because the import is lazy.
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row, error: lookupErr } = await supabaseAdmin
      .from("og_bot_remote_tokens")
      .select("signing_secret, origin_host, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (lookupErr) throw new Error(`lookup_failed: ${lookupErr.message}`);
    if (!row) throw new Error("token_not_found");
    if (row.revoked_at) throw new Error("token_revoked_locally");

    const headerHost = (() => {
      try {
        return getRequestHost();
      } catch {
        return undefined;
      }
    })();
    const originHost = (
      process.env.PUBLIC_HOST ??
      headerHost ??
      row.origin_host ??
      ""
    )
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
      .trim();

    if (!originHost) throw new Error("origin_host_unresolved");

    const nonce = randomUUID();
    const ts_unix = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", row.signing_secret)
      .update(`${originHost}|${data.externalUser}|${nonce}|${ts_unix}`)
      .digest("hex");

    const { createClient } = await import("@supabase/supabase-js");
    const og = createClient(REMOTE_SUPABASE_URL, REMOTE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: result, error } = await og.rpc("og_bot_token_burn", {
      _token: data.token,
      _origin_host: originHost,
      _external_user: data.externalUser,
      _nonce: nonce,
      _ts_unix: ts_unix,
      _signature: signature,
    });
    if (error) throw new Error(error.message);

    const burnRow = Array.isArray(result) ? result[0] : result;
    return {
      ok: Boolean(burnRow?.ok),
      reason: burnRow?.reason ?? null,
      uses_remaining: burnRow?.uses_remaining ?? null,
      grants_vip: burnRow?.grants_vip ?? null,
      expires_at: burnRow?.expires_at ?? null,
      burnt: Boolean(burnRow?.burnt),
    };
  });
