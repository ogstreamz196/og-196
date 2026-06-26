/**
 * Integration tests for the Stripe payments webhook handler.
 *
 * Drives `handleEvent` (exported from the route file) against an in-memory
 * fake of `supabaseAdmin`, covering:
 *   - one-off coin purchase → balance + coin_transactions row written once
 *   - duplicate session → no double-credit (reference dedupe)
 *   - VIP bundle checkout → user_roles upsert with role=vip
 *   - subscription.deleted → revokes VIP + mirrors row
 *
 * No network or DB — these guard the dispatch + side-effect contract so
 * future refactors of webhook.ts can't silently regress coin/VIP grants.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- in-memory fake supabaseAdmin ----------------------------------------
type Row = Record<string, any>;
interface Tables {
  stripe_webhook_events: Row[];
  coin_transactions: Row[];
  profiles: Row[];
  user_roles: Row[];
  subscriptions: Row[];
  payment_refunds: Row[];
}
const tables: Tables = {
  stripe_webhook_events: [],
  coin_transactions: [],
  profiles: [],
  user_roles: [],
  subscriptions: [],
  payment_refunds: [],
};

function makeQuery(name: keyof Tables) {
  const filters: Array<[string, any]> = [];
  let pending: any[] = tables[name];
  const apply = () =>
    filters.reduce((acc, [c, v]) => acc.filter((r) => r[c] === v), pending);
  const api: any = {
    select() { return api; },
    eq(col: string, val: any) { filters.push([col, val]); return api; },
    maybeSingle() {
      const rows = apply();
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
    insert(row: Row | Row[]) {
      const rows = Array.isArray(row) ? row : [row];
      // emulate unique constraint on stripe_webhook_events.event_id
      if (name === "stripe_webhook_events") {
        for (const r of rows) {
          if (tables.stripe_webhook_events.some((x) => x.event_id === r.event_id)) {
            return Promise.resolve({ data: null, error: { code: "23505", message: "dup" } });
          }
        }
      }
      tables[name].push(...rows);
      return Promise.resolve({ data: rows, error: null });
    },
    update(patch: Row) {
      return {
        eq(col: string, val: any) {
          for (const r of tables[name]) if (r[col] === val) Object.assign(r, patch);
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
    delete() {
      const localFilters: Array<[string, any]> = [];
      const chain: any = {
        eq(col: string, val: any) {
          localFilters.push([col, val]);
          if (localFilters.length >= 2) {
            tables[name] = tables[name].filter(
              (r) => !localFilters.every(([c, v]) => r[c] === v),
            ) as any;
            return Promise.resolve({ data: null, error: null });
          }
          return chain;
        },
      };
      return chain;
    },
    upsert(row: Row, opts?: { onConflict?: string }) {
      const conflictCols = (opts?.onConflict ?? "id").split(",").map((s) => s.trim());
      const idx = tables[name].findIndex((r) =>
        conflictCols.every((c) => r[c] === row[c]),
      );
      if (idx >= 0) Object.assign(tables[name][idx], row);
      else tables[name].push(row);
      return Promise.resolve({ data: null, error: null });
    },
  };
  return api;
}

const fakeAdmin = {
  from(name: keyof Tables) { return makeQuery(name); },
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: fakeAdmin,
}));
vi.mock("@/lib/stripe.server", () => ({
  createStripeClient: () => ({
    checkout: { sessions: { list: async () => ({ data: [] }) } },
  }),
  verifyWebhook: async () => ({}),
}));

import { handleEvent } from "@/routes/api/public/payments/webhook";

beforeEach(() => {
  for (const k of Object.keys(tables) as Array<keyof Tables>) tables[k].length = 0;
});
afterEach(() => vi.clearAllMocks());

const USER = "11111111-1111-1111-1111-111111111111";

function seedProfile(balance = 0) {
  tables.profiles.push({ id: USER, coin_balance: balance });
}

describe("payments webhook → coin credit", () => {
  it("credits the bundle's coins and writes a coin_transactions row", async () => {
    seedProfile(10);
    await handleEvent(
      {
        id: "evt_1",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_1",
            payment_status: "paid",
            metadata: { userId: USER, bundleId: "coins_100", coins: "100" },
          },
        },
      },
      "sandbox",
    );
    expect(tables.profiles[0].coin_balance).toBe(110);
    expect(tables.coin_transactions).toHaveLength(1);
    expect(tables.coin_transactions[0]).toMatchObject({
      user_id: USER, amount: 100, type: "stripe_purchase",
      reference: "stripe:sandbox:cs_1",
    });
  });

  it("does NOT double-credit when the same session arrives twice", async () => {
    seedProfile(0);
    const event = {
      id: "evt_2",
      type: "checkout.session.completed",
      data: { object: { id: "cs_dupe", payment_status: "paid",
        metadata: { userId: USER, bundleId: "coins_50", coins: "50" } } },
    };
    await handleEvent(event, "sandbox");
    // simulate a redelivery: webhook_events dedupe is checked at the route layer,
    // but creditCoinsForSession itself also short-circuits on existing reference.
    await handleEvent({ ...event, id: "evt_2_retry" }, "sandbox");
    expect(tables.profiles[0].coin_balance).toBe(50);
    expect(tables.coin_transactions).toHaveLength(1);
  });

  it("ignores unpaid sessions", async () => {
    seedProfile(5);
    await handleEvent(
      {
        id: "evt_3",
        type: "checkout.session.completed",
        data: { object: { id: "cs_unpaid", payment_status: "unpaid",
          metadata: { userId: USER, bundleId: "coins_100", coins: "100" } } },
      },
      "sandbox",
    );
    expect(tables.profiles[0].coin_balance).toBe(5);
    expect(tables.coin_transactions).toHaveLength(0);
  });
});

describe("payments webhook → VIP role", () => {
  it("grants VIP on vip_monthly checkout", async () => {
    seedProfile();
    await handleEvent(
      {
        id: "evt_vip_1",
        type: "checkout.session.completed",
        data: { object: { id: "cs_vip", payment_status: "paid",
          metadata: { userId: USER, bundleId: "vip_monthly" } } },
      },
      "live",
    );
    expect(tables.user_roles).toEqual([{ user_id: USER, role: "vip" }]);
    // VIP grant must NOT also credit coins
    expect(tables.coin_transactions).toHaveLength(0);
  });

  it("revokes VIP on subscription.deleted", async () => {
    tables.user_roles.push({ user_id: USER, role: "vip" });
    await handleEvent(
      {
        id: "evt_sub_del",
        type: "customer.subscription.deleted",
        data: { object: {
          id: "sub_1", customer: "cus_1", status: "canceled",
          cancel_at_period_end: false, items: { data: [{ price: { id: "p_1" } }] },
          metadata: { userId: USER },
        } },
      },
      "live",
    );
    expect(tables.user_roles).toHaveLength(0);
    expect(tables.subscriptions[0]).toMatchObject({
      user_id: USER, stripe_subscription_id: "sub_1", status: "canceled",
    });
  });
});
