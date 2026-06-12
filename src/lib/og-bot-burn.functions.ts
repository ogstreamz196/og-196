// Burn one use of an OG Bot token issued by the main project.
//
// The token's signing_secret is returned ONCE at mint time and must never
// reach the browser — burn signatures are computed inside this server fn.
// Callers pass `signingSecret` from their secure store (DB row, KV, etc.).
//
// Origin host resolution (in order):
//   1. process.env.PUBLIC_HOST  (explicit override)
//   2. request Host header      (whatever the user hit us on)
// The chosen host must be in the main project's og_bot_token_domains
// whitelist for the burn to succeed (else => domain_mismatch).
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";

const REMOTE_SUPABASE_URL = "https://dawcdietltejjxbdimkm.supabase.co";
const REMOTE_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhd2NkaWV0bHRlamp4YmRpbWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTcyODYsImV4cCI6MjA5MzgzMzI4Nn0.evNy8qk5a3MLZxJRSUOTNfKbkeqhbgxVVfJWxqY7BPA";

const InputSchema = z.object({
  token: z.string().min(8).max(200),
  signingSecret: z.string().min(8).max(512),
  externalUser: z.string().min(1).max(256),
  originHost: z.string().min(1).max(253).optional(),
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
    const headerHost = (() => {
      try {
        return getRequestHost();
      } catch {
        return undefined;
      }
    })();
    const originHost = (
      data.originHost ??
      process.env.PUBLIC_HOST ??
      headerHost ??
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
    const signature = createHmac("sha256", data.signingSecret)
      .update(`${originHost}|${data.externalUser}|${nonce}|${ts_unix}`)
      .digest("hex");

    // Lazy import to keep this module client-safe (RPC stub on client).
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

    const row = Array.isArray(result) ? result[0] : result;
    return {
      ok: Boolean(row?.ok),
      reason: row?.reason ?? null,
      uses_remaining: row?.uses_remaining ?? null,
      grants_vip: row?.grants_vip ?? null,
      expires_at: row?.expires_at ?? null,
      burnt: Boolean(row?.burnt),
    };
  });
