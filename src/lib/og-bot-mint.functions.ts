// Admin-only: mint a new OG Bot token against the main project
// (https://ogstreamz.lovable.app), then store the full response — including
// signing_secret — server-side in `og_bot_remote_tokens`. The caller only
// receives the public surface ({ token, expires_at, uses_remaining, grants_vip }).
//
// Signing: HMAC-SHA256 over `${ts}.${nonce}.${rawBody}` using
// OG_BOT_REMOTE_MINT_SECRET; sent as X-Admin-Timestamp / X-Admin-Nonce /
// X-Admin-Signature headers. The mint secret never leaves this server.
import { createServerFn } from "@tanstack/react-start";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MINT_URL = "https://ogstreamz.lovable.app/api/public/og-bot/mint";

const InputSchema = z.object({
  originHost: z.string().min(1).max(253),
  externalUser: z.string().min(1).max(256).optional(),
  uses: z.number().int().min(1).max(100000).optional(),
  grantsVip: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(), // ISO-8601
});

export type MintResult = {
  token: string;
  expires_at: string | null;
  uses_remaining: number | null;
  grants_vip: boolean;
};

export const mintAndStoreOgBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<MintResult> => {
    // Gate: only admins may mint tokens against the main project.
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc(
      "has_role",
      { _user_id: context.userId, _role: "admin" },
    );
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("forbidden");

    const secret = process.env.OG_BOT_REMOTE_MINT_SECRET;
    if (!secret) throw new Error("OG_BOT_REMOTE_MINT_SECRET missing");

    const originHost = data.originHost
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
      .trim();
    if (!originHost) throw new Error("invalid_origin_host");

    const body: Record<string, unknown> = { origin_host: originHost };
    if (data.externalUser) body.external_user = data.externalUser;
    if (data.uses != null) body.uses = data.uses;
    if (data.grantsVip != null) body.grants_vip = data.grantsVip;
    if (data.expiresAt) body.expires_at = data.expiresAt;

    const rawBody = JSON.stringify(body);
    const ts = String(Math.floor(Date.now() / 1000));
    const nonce = randomUUID();
    const signature = createHmac("sha256", secret)
      .update(`${ts}.${nonce}.${rawBody}`)
      .digest("hex");

    const res = await fetch(MINT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Timestamp": ts,
        "X-Admin-Nonce": nonce,
        "X-Admin-Signature": signature,
      },
      body: rawBody,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`mint_failed_${res.status}: ${text.slice(0, 200)}`);
    }

    const minted = (await res.json()) as {
      token: string;
      signing_secret: string;
      expires_at: string | null;
      uses_remaining: number | null;
      grants_vip: boolean;
    };

    if (!minted?.token || !minted?.signing_secret) {
      throw new Error("mint_response_invalid");
    }

    // Persist via service-role (RLS-bypassing) client. Lazy-imported so this
    // module stays client-safe (only the .handler() body ships server-only).
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error: insertErr } = await supabaseAdmin
      .from("og_bot_remote_tokens")
      .insert({
        token: minted.token,
        signing_secret: minted.signing_secret,
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
