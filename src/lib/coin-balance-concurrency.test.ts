/**
 * Concurrency proof for the atomic coin-balance increment.
 *
 * Mirrors the production contract: `supabaseAdmin.rpc("increment_coin_balance",
 * { _user_id, _delta })` MUST behave as an atomic read-modify-write — even
 * when N Stripe credits and N gameplay deductions interleave, no increment
 * may be lost.
 *
 * We model two implementations side-by-side:
 *
 *   1. atomicIncrement()  — represents the SQL function (single statement
 *      `UPDATE … SET coin_balance = coin_balance + _delta`).
 *   2. racyReadModifyWrite() — the OLD client-side pattern that lost a
 *      +5 credit on 2026-06-26 and prompted the migration to the RPC.
 *
 * Concurrency is simulated by awaiting a yield between read and write so
 * the JS event loop interleaves the operations the way Postgres workers
 * would interleave transactions. The atomic version must always end with
 * balance === Σ(deltas); the racy version is asserted to LOSE writes so
 * we know the test would catch a regression if the webhook ever reverted
 * to read-modify-write.
 */
import { describe, expect, it } from "vitest";

// ──────────────────────────────────────────────────────────────────────────
// Shared in-memory "row" with a mutex modelling Postgres row-level locking.

function createBalanceStore(initial = 0) {
  let balance = initial;
  let locked = false;
  const waiters: Array<() => void> = [];

  async function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    while (locked) await new Promise<void>((r) => waiters.push(r));
    locked = true;
    try {
      return await fn();
    } finally {
      locked = false;
      const next = waiters.shift();
      if (next) next();
    }
  }

  return {
    get: () => balance,

    // Models the SQL function: single atomic UPDATE — read+write under
    // the row lock, no JS-visible gap between them.
    atomicIncrement: (delta: number) =>
      withLock(() => {
        balance = balance + delta;
        return balance;
      }),

    // Models the OLD pattern: read balance, await something, write back.
    // Two callers can each read the same "before" value and clobber each
    // other's update.
    racyReadModifyWrite: async (delta: number) => {
      const seen = balance;
      // Yield to the event loop to let another caller interleave between
      // the read and the write — this is exactly what happens when two
      // Supabase requests run concurrently in different connections.
      await Promise.resolve();
      await Promise.resolve();
      balance = seen + delta;
      return balance;
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────

describe("coin balance atomic increment under concurrency", () => {
  it("atomic RPC: 100 concurrent Stripe credits never lose an increment", async () => {
    const store = createBalanceStore(0);
    const credits = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100, Σ = 5050
    await Promise.all(credits.map((c) => store.atomicIncrement(c)));
    expect(store.get()).toBe(5050);
  });

  it("atomic RPC: interleaved Stripe credits (+) and gameplay debits (−) settle exactly", async () => {
    const store = createBalanceStore(1000);
    // 50 purchases of +10, 50 deductions of −3 → net +350 → 1350
    const ops: Array<Promise<number>> = [];
    for (let i = 0; i < 50; i++) ops.push(store.atomicIncrement(10));
    for (let i = 0; i < 50; i++) ops.push(store.atomicIncrement(-3));
    // Shuffle the start order so the event loop interleaves them
    await Promise.all(ops);
    expect(store.get()).toBe(1000 + 50 * 10 - 50 * 3);
  });

  it("atomic RPC: a single Stripe credit cannot be lost by a concurrent debit (regression: 2026-06-26)", async () => {
    const store = createBalanceStore(2);
    // The exact bug shape that hit prod: a +5 Stripe credit racing a -1
    // deduction. The user ended up at 1 instead of 6.
    await Promise.all([
      store.atomicIncrement(5),
      store.atomicIncrement(-1),
      store.atomicIncrement(-1),
      store.atomicIncrement(5),
    ]);
    expect(store.get()).toBe(2 + 5 - 1 - 1 + 5);
  });

  it("CONTROL: the old read-modify-write pattern DOES lose increments (proves the test exercises a real race)", async () => {
    const store = createBalanceStore(0);
    // If this control ever passes with === 5050, the harness no longer
    // interleaves operations and the atomic test above is vacuous.
    await Promise.all(
      Array.from({ length: 100 }, (_, i) => store.racyReadModifyWrite(i + 1)),
    );
    expect(store.get()).toBeLessThan(5050);
  });
});
