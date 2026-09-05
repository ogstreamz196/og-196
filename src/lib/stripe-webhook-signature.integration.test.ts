import { describe, it, expect, beforeAll } from "vitest";
import { Buffer } from "node:buffer";
import { verifyWebhook } from "@/lib/stripe.server";

const SECRET = "whsec_test_signature_verification_dummy_value_123";

beforeAll(() => {
  // BYOK mode reads STRIPE_WEBHOOK_SECRET; managed mode reads the env-specific ones.
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET = SECRET;
  process.env.PAYMENTS_LIVE_WEBHOOK_SECRET = SECRET;
});

async function sign(payload: string, secret: string, timestamp: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  return Buffer.from(new Uint8Array(sig)).toString("hex");
}

function makeRequest(body: string, header: string | null): Request {
  return new Request("https://example.com/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    headers: header ? { "stripe-signature": header } : {},
    body,
  });
}

describe("verifyWebhook signature verification", () => {
  const payload = JSON.stringify({
    id: "evt_test_1",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_1" } },
  });

  it("accepts a valid signed payload", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(payload, SECRET, ts);
    const req = makeRequest(payload, `t=${ts},v1=${sig}`);
    const event = await verifyWebhook(req, "sandbox");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejects a tampered body with the original signature", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(payload, SECRET, ts);
    const tampered = payload.replace("cs_test_1", "cs_test_HACKED");
    const req = makeRequest(tampered, `t=${ts},v1=${sig}`);
    await expect(verifyWebhook(req, "sandbox")).rejects.toThrow(/Invalid webhook signature/);
  });

  it("rejects a signature produced with the wrong secret", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(payload, "whsec_wrong_secret", ts);
    const req = makeRequest(payload, `t=${ts},v1=${sig}`);
    await expect(verifyWebhook(req, "sandbox")).rejects.toThrow(/Invalid webhook signature/);
  });

  it("rejects a stale timestamp (>5 minutes old)", async () => {
    const ts = Math.floor(Date.now() / 1000) - 600;
    const sig = await sign(payload, SECRET, ts);
    const req = makeRequest(payload, `t=${ts},v1=${sig}`);
    await expect(verifyWebhook(req, "sandbox")).rejects.toThrow(/timestamp too old/);
  });

  it("rejects a missing signature header", async () => {
    const req = makeRequest(payload, null);
    await expect(verifyWebhook(req, "sandbox")).rejects.toThrow(/Missing signature/);
  });

  it("rejects a malformed signature header", async () => {
    const req = makeRequest(payload, "garbage");
    await expect(verifyWebhook(req, "sandbox")).rejects.toThrow(/Invalid signature format/);
  });

  it("rejects when timestamp is reused but body is swapped", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(payload, SECRET, ts);
    const swapped = JSON.stringify({ id: "evt_evil", type: "x", data: { object: {} } });
    const req = makeRequest(swapped, `t=${ts},v1=${sig}`);
    await expect(verifyWebhook(req, "sandbox")).rejects.toThrow(/Invalid webhook signature/);
  });
});
