// OG Bot mothership contract — DO NOT TWEAK THE WIRE FORMAT.
//
// HMAC payload is literally `${ts}.${nonce}.${rawBody}` with dot separators.
// Headers are lowercase x-admin-timestamp / x-admin-nonce / x-admin-signature.
// `ts` is unix SECONDS. nonce is crypto.randomUUID().
// Re-serialising rawBody between sign + send breaks the signature.
//
// All three server fns require auth. Mint also writes through service role
// (lazy import only — keep this module client-safe at module scope).
import { createServerFn } from "@tanstack/react-start";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MOTHERSHIP_DEFAULT = "https://ogstreamz.lovable.app";

function mothershipBase(): string {
  return (process.env.OG_BOT_MOTHERSHIP_URL ?? MOTHERSHIP_DEFAULT).replace(
    /\/+$/,
    "",
  );
}

// Sign an outbound admin request to the mothership.
// Payload string is literally `${ts}.${nonce}.${rawBody}`.
// ts is unix SECONDS; the mothership enforces a ±300s drift window, so
// don't cache or pre-sign — sign at send time.
function signAdminRequest(rawBody: string): {
  ts: string;
  nonce: string;
  sig: string;
} {
  const secret = process.env.OG_BOT_REMOTE_MINT_SECRET;
  if (!secret) throw new Error("OG_BOT_REMOTE_MINT_SECRET missing");
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const sig = createHmac("sha256", secret)
    .update(`${ts}.${nonce}.${rawBody}`)
    .digest("hex");
  return { ts, nonce, sig };
}

const MintInput = z.object({
  originHost: z.string().trim().min(1).max(253),
  externalUser: z.string().trim().min(1).max(256).optional(),
  usesRemaining: z.number().int().min(1).max(1_000_000).optional(),
  grantsVip: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type MintedToken = {
  token: string;
  expires_at: string | null;
  uses_remaining: number | null;
  grants_vip: boolean;
};

export const mintOgBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => MintInput.parse(data))
  .handler(async ({ data, context }): Promise<MintedToken> => {
    const baseUrl = mothershipBase();

    const originHost = data.originHost
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
      .trim();
    if (!originHost) throw new Error("invalid_origin");

    const payload: Record<string, unknown> = { origin_host: originHost };
    if (data.externalUser !== undefined)
      payload.external_user = data.externalUser;
    if (data.usesRemaining !== undefined) payload.uses = data.usesRemaining;
    if (data.grantsVip !== undefined) payload.grants_vip = data.grantsVip;
    if (data.expiresAt !== undefined) payload.expires_at = data.expiresAt;

    const rawBody = JSON.stringify(payload);
    const { ts, nonce, sig } = signAdminRequest(rawBody);

    const res = await fetch(`${baseUrl}/api/public/og-bot/mint`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-timestamp": ts,
        "x-admin-nonce": nonce,
        "x-admin-signature": sig,
      },
      body: rawBody,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`og-bot mint failed: ${res.status} ${text}`);
    }

    const minted = (await res.json()) as {
      token: string;
      expires_at: string | null;
      uses_remaining: number | null;
      grants_vip: boolean;
    };
    if (!minted?.token) throw new Error("og-bot mint failed: empty token");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error: insertErr } = await supabaseAdmin
      .from("og_bot_remote_tokens")
      .insert({
        token: minted.token,
        signing_secret: null,
        external_user: data.externalUser ?? null,
        origin_host: originHost,
        expires_at: minted.expires_at,
        uses_remaining: minted.uses_remaining,
        grants_vip: Boolean(minted.grants_vip),
        created_by: context.userId,
      });
    if (insertErr) throw new Error(`store_failed: ${insertErr.message}`);

    return {
      token: minted.token,
      expires_at: minted.expires_at,
      uses_remaining: minted.uses_remaining,
      grants_vip: Boolean(minted.grants_vip),
    };
  });

export type StoredToken = {
  id: string;
  origin_host: string;
  external_user: string | null;
  expires_at: string | null;
  uses_remaining: number | null;
  grants_vip: boolean;
  revoked_at: string | null;
  created_at: string;
};

export const listMyOgBotTokens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StoredToken[]> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin
      .from("og_bot_remote_tokens")
      .select(
        "id, origin_host, external_user, expires_at, uses_remaining, grants_vip, revoked_at, created_at",
      )
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as StoredToken[];
  });

const RevokeInput = z.object({ id: z.string().uuid() });

export const revokeOgBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RevokeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("og_bot_remote_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("created_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const IntrospectInput = z.object({
  token: z.string().trim().min(1).max(512),
  originHost: z.string().trim().min(1).max(253),
});

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export type Introspection = {
  ok: boolean;
  reason?: string | null;
  expires_at?: string | null;
  uses_remaining?: number | null;
  grants_vip?: boolean | null;
  bound_external_user?: string | null;
  domains?: string[] | null;
  scopes?: JsonValue | null;
  policy?: JsonValue | null;
  token_type?: "og_bot" | "developer" | "remote" | null;
};

export const introspectOgBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => IntrospectInput.parse(data))
  .handler(async ({ data }): Promise<Introspection> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const originHost = data.originHost
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
      .trim();
    if (!originHost) throw new Error("invalid_origin");

    const token = data.token.trim();

    const { data: localOgToken, error: localOgTokenError } = await supabaseAdmin
      .from("og_bot_tokens")
      .select("user_id, expires_at, revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (localOgTokenError) {
      throw new Error(`introspect failed: ${localOgTokenError.message}`);
    }

    if (localOgToken) {
      const isRevoked = Boolean(localOgToken.revoked_at);
      const isExpired = Boolean(
        localOgToken.expires_at &&
          new Date(localOgToken.expires_at).getTime() < Date.now(),
      );

      return {
        ok: !isRevoked && !isExpired,
        reason: isRevoked ? "revoked" : isExpired ? "expired" : null,
        expires_at: localOgToken.expires_at,
        uses_remaining: null,
        grants_vip: null,
        bound_external_user: localOgToken.user_id,
        domains: null,
        scopes: null,
        policy: null,
        token_type: "og_bot",
      };
    }

    const { data: developerToken, error: developerTokenError } =
      await supabaseAdmin
        .from("bot_tokens")
        .select("allowed_domain, status")
        .eq("token_string", token)
        .maybeSingle();

    if (developerTokenError) {
      throw new Error(`introspect failed: ${developerTokenError.message}`);
    }

    if (developerToken) {
      const { data: isValid, error: validateError } = await supabaseAdmin.rpc(
        "validate_bot_token",
        {
          p_token: token,
          p_origin: originHost,
        },
      );

      if (validateError) {
        throw new Error(`introspect failed: ${validateError.message}`);
      }

      const normalizedAllowedDomain = developerToken.allowed_domain
        ? developerToken.allowed_domain
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .split("/")[0]
            .split(":")[0]
            .trim()
        : null;

      return {
        ok: Boolean(isValid),
        reason:
          developerToken.status !== "active"
            ? developerToken.status
            : !developerToken.allowed_domain
              ? "not_bound"
              : isValid
                ? null
                : "origin_mismatch",
        expires_at: null,
        uses_remaining: null,
        grants_vip: null,
        bound_external_user: null,
        domains: normalizedAllowedDomain ? [normalizedAllowedDomain] : null,
        scopes: null,
        policy: null,
        token_type: "developer",
      };
    }

    // Remote fallback: HMAC-signed call to the mothership introspect endpoint.
    const rawBody = JSON.stringify({
      token,
      origin_host: originHost,
    });
    const { ts, nonce, sig } = signAdminRequest(rawBody);

    const res = await fetch(`${mothershipBase()}/api/public/og-bot/introspect`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-timestamp": ts,
        "x-admin-nonce": nonce,
        "x-admin-signature": sig,
      },
      body: rawBody,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`introspect failed: ${res.status} ${text.slice(0, 300)}`);
    }
    try {
      const parsed = JSON.parse(text) as Introspection | Introspection[];
      const result = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!result || typeof result !== "object") {
        throw new Error("empty introspection result");
      }
      return {
        ...result,
        token_type: "remote",
      };
    } catch {
      throw new Error(`introspect returned non-JSON: ${text.slice(0, 300)}`);
    }
  });

// Widget chat proxy. Standard per-site tokens auth as Bearer against the
// mothership's public widget endpoint — no HMAC, no admin secret. Wrapped
// in a server fn so callers don't need to know the upstream URL.
const ChatInput = z.object({
  token: z.string().trim().min(1).max(512),
  message: z.string().trim().min(1).max(8000),
  conversationId: z.string().trim().max(128).optional(),
});

export const chatWithOgBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ChatInput.parse(data))
  .handler(async ({ data }): Promise<{ reply: string; raw: string }> => {
    const body: Record<string, unknown> = { message: data.message };
    if (data.conversationId) body.conversation_id = data.conversationId;

    const res = await fetch(`${mothershipBase()}/api/public/og-bot-widget`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${data.token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`chat failed: ${res.status} ${text.slice(0, 300)}`);
    }
    let reply = text;
    try {
      const parsed = JSON.parse(text) as { reply?: string; message?: string };
      reply = parsed.reply ?? parsed.message ?? text;
    } catch {
      /* keep raw text */
    }
    return { reply, raw: text };
  });
