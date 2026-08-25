import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Automated backend health check.
 *
 * Verifies every API key the generation + bot pipeline depends on
 * (GEMINI, SUNO, PERPLEXITY, OG_BOT_*) by actually calling the provider where
 * a cheap probe exists, and returns actionable remediation for each failure.
 */

export type HealthStatus = "ok" | "missing" | "invalid" | "unreachable" | "degraded";

export type HealthCheck = {
  key: string;
  label: string;
  group: "AI providers" | "OG Bot" | "Core";
  required: boolean;
  status: HealthStatus;
  detail: string;
  fix?: string;
  latencyMs?: number;
};

export type HealthReport = {
  checkedAt: string;
  healthy: boolean;
  okCount: number;
  failCount: number;
  checks: HealthCheck[];
};

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const supabase = context.supabase as {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  };
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const SECRETS_FIX = "Open Project Settings → Secrets and set this value, then re-run the check.";

function missing(name: string, extra?: string): Omit<HealthCheck, "key" | "label" | "group" | "required"> {
  return {
    status: "missing",
    detail: `${name} is not set — every call that needs it fails immediately.`,
    fix: extra ?? SECRETS_FIX,
  };
}

async function timed<T>(fn: () => Promise<T>) {
  const t0 = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - t0 };
}

type Partial_ = Omit<HealthCheck, "key" | "label" | "group" | "required">;

async function checkGemini(): Promise<Partial_> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) return missing("GEMINI_API_KEY");
  try {
    const { result, latencyMs } = await timed(() =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`),
    );
    if (result.status === 400 || result.status === 401 || result.status === 403) {
      return {
        status: "invalid",
        detail: `Gemini rejected the key (HTTP ${result.status}).`,
        fix: "Generate a fresh key in Google AI Studio and update GEMINI_API_KEY in Secrets.",
        latencyMs,
      };
    }
    if (!result.ok) {
      return {
        status: "unreachable",
        detail: `Gemini API returned HTTP ${result.status}.`,
        fix: "Transient Google outage or quota block — retry, then check quota in Google AI Studio.",
        latencyMs,
      };
    }
    const body = (await result.json().catch(() => ({}))) as { models?: unknown[] };
    return {
      status: "ok",
      detail: `Key valid · ${body.models?.length ?? 0} models available.`,
      latencyMs,
    };
  } catch (e) {
    return {
      status: "unreachable",
      detail: `Could not reach Gemini: ${e instanceof Error ? e.message : "network error"}`,
      fix: "Retry in a moment; if it persists Google's API is down.",
    };
  }
}

async function checkSuno(): Promise<Partial_> {
  const key = process.env["SUNO_API_KEY"];
  if (!key) return missing("SUNO_API_KEY");
  try {
    const { result, latencyMs } = await timed(() =>
      fetch("https://apibox.erweima.ai/api/v1/generate/credit", {
        headers: { Authorization: `Bearer ${key}` },
      }),
    );
    const text = await result.text().catch(() => "");
    if (result.status === 401 || result.status === 403) {
      return {
        status: "invalid",
        detail: `Suno rejected the key (HTTP ${result.status}).`,
        fix: "Re-copy the API key from your Suno provider dashboard into SUNO_API_KEY.",
        latencyMs,
      };
    }
    if (!result.ok) {
      return {
        status: "unreachable",
        detail: `Suno API returned HTTP ${result.status}: ${text.slice(0, 120)}`,
        fix: "Song generation will fail until Suno responds — retry shortly.",
        latencyMs,
      };
    }
    let credits: number | null = null;
    try {
      const parsed = JSON.parse(text) as { data?: number | { credit?: number } };
      credits =
        typeof parsed.data === "number"
          ? parsed.data
          : typeof parsed.data?.credit === "number"
            ? parsed.data.credit
            : null;
    } catch { /* non-JSON body is still a 200 */ }
    if (credits !== null && credits <= 0) {
      return {
        status: "degraded",
        detail: "Key valid but the Suno account has 0 credits left.",
        fix: "Top up credits with your Suno provider — generations will fail at 0.",
        latencyMs,
      };
    }
    return {
      status: "ok",
      detail: credits === null ? "Key valid." : `Key valid · ${credits} credits left.`,
      latencyMs,
    };
  } catch (e) {
    return {
      status: "unreachable",
      detail: `Could not reach Suno: ${e instanceof Error ? e.message : "network error"}`,
      fix: "Retry shortly — the Suno API host may be down.",
    };
  }
}

async function checkPerplexity(): Promise<Partial_> {
  const key = process.env["PERPLEXITY_API_KEY"];
  if (!key) return missing("PERPLEXITY_API_KEY");
  try {
    const { result, latencyMs } = await timed(() =>
      fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      }),
    );
    if (result.status === 401 || result.status === 403) {
      return {
        status: "invalid",
        detail: `Perplexity rejected the key (HTTP ${result.status}).`,
        fix: "Issue a new key at perplexity.ai/settings/api and update PERPLEXITY_API_KEY.",
        latencyMs,
      };
    }
    if (result.status === 429) {
      return {
        status: "degraded",
        detail: "Key valid but currently rate-limited (HTTP 429).",
        fix: "Wait for the limit window to reset or raise the plan limit.",
        latencyMs,
      };
    }
    if (!result.ok) {
      const text = await result.text().catch(() => "");
      return {
        status: "unreachable",
        detail: `Perplexity returned HTTP ${result.status}: ${text.slice(0, 120)}`,
        fix: "Retry shortly; if it persists check the Perplexity status page.",
        latencyMs,
      };
    }
    return { status: "ok", detail: "Key valid · completions endpoint responding.", latencyMs };
  } catch (e) {
    return {
      status: "unreachable",
      detail: `Could not reach Perplexity: ${e instanceof Error ? e.message : "network error"}`,
      fix: "Retry shortly — network or provider outage.",
    };
  }
}

async function checkOgBotToken(): Promise<Partial_> {
  const token = process.env["OG_BOT_TOKEN"];
  if (!token) {
    return missing(
      "OG_BOT_TOKEN",
      "Get the token from @BotFather (/mybots → API token) and save it as OG_BOT_TOKEN.",
    );
  }
  if (!/^\d+:[\w-]{30,}$/.test(token)) {
    return {
      status: "invalid",
      detail: "OG_BOT_TOKEN is not in BotFather format (123456:ABC…).",
      fix: "Re-copy the whole token from @BotFather — no spaces, no quotes.",
    };
  }
  try {
    const { result, latencyMs } = await timed(() =>
      fetch(`https://api.telegram.org/bot${token}/getMe`),
    );
    const body = (await result.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { username?: string };
    };
    if (!result.ok || body.ok === false) {
      return {
        status: "invalid",
        detail: `Telegram rejected the bot token: ${body.description ?? `HTTP ${result.status}`}`,
        fix: "The token was revoked or regenerated — get a fresh one from @BotFather.",
        latencyMs,
      };
    }
    return { status: "ok", detail: `Live bot @${body.result?.username ?? "unknown"}.`, latencyMs };
  } catch (e) {
    return {
      status: "unreachable",
      detail: `Could not reach Telegram: ${e instanceof Error ? e.message : "network error"}`,
      fix: "Retry shortly — api.telegram.org was not reachable.",
    };
  }
}

async function checkUrlSecret(name: string, label: string): Promise<Partial_> {
  const raw = process.env[name];
  if (!raw) return missing(name);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      status: "invalid",
      detail: `${name} is not a valid URL ("${raw.slice(0, 40)}").`,
      fix: `Set ${name} to a full https:// URL.`,
    };
  }
  try {
    const { result, latencyMs } = await timed(() =>
      fetch(url.toString(), { method: "GET", redirect: "follow" }),
    );
    if (result.status >= 500) {
      return {
        status: "unreachable",
        detail: `${label} responded HTTP ${result.status}.`,
        fix: `${label} is up but erroring — check its own logs.`,
        latencyMs,
      };
    }
    return { status: "ok", detail: `Reachable (HTTP ${result.status}).`, latencyMs };
  } catch (e) {
    return {
      status: "unreachable",
      detail: `${label} did not respond: ${e instanceof Error ? e.message : "network error"}`,
      fix: `Confirm ${name} points at a running host.`,
    };
  }
}

function checkMintSecret(): Partial_ {
  const secret = process.env["OG_BOT_REMOTE_MINT_SECRET"];
  if (!secret) return missing("OG_BOT_REMOTE_MINT_SECRET");
  if (secret.length < 24) {
    return {
      status: "invalid",
      detail: `OG_BOT_REMOTE_MINT_SECRET is only ${secret.length} characters — too weak for HMAC signing.`,
      fix: "Replace it with a random 32+ character value (and update the remote bot to match).",
    };
  }
  return { status: "ok", detail: "Signing secret present and long enough." };
}

function checkLovable(): Partial_ {
  return process.env["LOVABLE_API_KEY"]
    ? { status: "ok", detail: "Gateway key present." }
    : missing("LOVABLE_API_KEY", "Re-enable the AI gateway so LOVABLE_API_KEY is re-issued.");
}

type Spec = Pick<HealthCheck, "key" | "label" | "group" | "required"> & {
  run: () => Promise<Partial_> | Partial_;
};

const SPECS: Spec[] = [
  { key: "gemini", label: "GEMINI_API_KEY (lyrics)", group: "AI providers", required: true, run: checkGemini },
  { key: "suno", label: "SUNO_API_KEY (audio)", group: "AI providers", required: true, run: checkSuno },
  { key: "perplexity", label: "PERPLEXITY_API_KEY (research)", group: "AI providers", required: true, run: checkPerplexity },
  { key: "lovable_ai", label: "LOVABLE_API_KEY (gateway)", group: "Core", required: true, run: checkLovable },
  { key: "og_bot_token", label: "OG_BOT_TOKEN (Telegram bot)", group: "OG Bot", required: true, run: checkOgBotToken },
  {
    key: "og_bot_host",
    label: "OG_BOT_HOST",
    group: "OG Bot",
    required: true,
    run: () => checkUrlSecret("OG_BOT_HOST", "OG Bot host"),
  },
  {
    key: "og_bot_mothership",
    label: "OG_BOT_MOTHERSHIP_URL",
    group: "OG Bot",
    required: true,
    run: () => checkUrlSecret("OG_BOT_MOTHERSHIP_URL", "OG Bot mothership"),
  },
  {
    key: "og_bot_mint_secret",
    label: "OG_BOT_REMOTE_MINT_SECRET",
    group: "OG Bot",
    required: true,
    run: () => checkMintSecret(),
  },
];

export const runApiHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HealthReport> => {
    await assertAdmin(context);

    const checks = await Promise.all(
      SPECS.map(async (spec): Promise<HealthCheck> => {
        try {
          const outcome = await spec.run();
          return { key: spec.key, label: spec.label, group: spec.group, required: spec.required, ...outcome };
        } catch (e) {
          return {
            key: spec.key,
            label: spec.label,
            group: spec.group,
            required: spec.required,
            status: "unreachable",
            detail: e instanceof Error ? e.message : "Check threw an unexpected error.",
            fix: "Re-run the check; if it keeps failing the provider host is unreachable.",
          };
        }
      }),
    );

    const failCount = checks.filter((c) => c.status !== "ok").length;
    return {
      checkedAt: new Date().toISOString(),
      healthy: checks.every((c) => c.status === "ok" || !c.required),
      okCount: checks.length - failCount,
      failCount,
      checks,
    };
  });
