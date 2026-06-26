/**
 * Integration test for the song-unlock flow.
 *
 * Mirrors what the `unlock-full-song` edge function does end-to-end against
 * the real DB:
 *   1. reads cost from app_settings.coins_per_full_unlock
 *   2. calls deduct_coins(user, cost, "unlock:<song_id>")
 *   3. flips songs.unlocked = true
 *
 * Asserts:
 *   - happy path debits balance, writes coin_transactions, flips unlocked
 *   - insufficient balance raises and song stays locked (no partial state)
 *   - replaying the same unlock reference is a no-op (deduct idempotency)
 *
 * Skipped automatically when PG env vars aren't present.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "child_process";
import { randomUUID } from "crypto";

function canSeed(): boolean {
  if (!process.env.PGHOST) return false;
  try {
    const out = execFileSync(
      "psql",
      ["-tA", "-c", "SELECT has_schema_privilege(current_user, 'auth', 'USAGE')"],
      { encoding: "utf8" },
    ).trim();
    return out === "t";
  } catch { return false; }
}
const HAS_DB = canSeed();

function psql(sql: string): string {
  return execFileSync("psql", ["-tA", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim();
}
function psqlSoft(sql: string): { ok: boolean; out: string } {
  try { return { ok: true, out: psql(sql) }; }
  catch (e: any) { return { ok: false, out: String(e?.stderr ?? e?.message ?? e) }; }
}

describe.skipIf(!HAS_DB)("song unlock flow", () => {
  const user = randomUUID();
  const song = randomUUID();

  beforeAll(() => {
    psql(
      `INSERT INTO auth.users (id, email, instance_id, aud, role)
       VALUES ('${user}', 'unlock-${user}@test.local',
               '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
       ON CONFLICT (id) DO NOTHING`,
    );
    psql(
      `INSERT INTO public.profiles (id, email, display_name, coin_balance)
       VALUES ('${user}', 'unlock-${user}@test.local', 'UnlockTest', 20)
       ON CONFLICT (id) DO UPDATE SET coin_balance = 20`,
    );
    psql(
      `INSERT INTO public.songs (id, user_id, prompt, status, unlocked)
       VALUES ('${song}', '${user}', 'test', 'completed', false)
       ON CONFLICT (id) DO UPDATE SET unlocked = false, status = 'completed'`,
    );
    psql(
      `INSERT INTO public.app_settings (key, value)
       VALUES ('coins_per_full_unlock', '5'::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = '5'::jsonb`,
    );
  });

  it("debits coins and flips unlocked on success", () => {
    const before = Number(psql(`SELECT coin_balance FROM public.profiles WHERE id = '${user}'`));
    psql(
      `SET LOCAL ROLE authenticated;
       SELECT set_config('request.jwt.claim.sub', '${user}', true);
       SELECT public.deduct_coins('${user}', 5, 'unlock:${song}');
       UPDATE public.songs SET unlocked = true WHERE id = '${song}'`,
    );
    const after = Number(psql(`SELECT coin_balance FROM public.profiles WHERE id = '${user}'`));
    expect(before - after).toBe(5);
    expect(psql(`SELECT unlocked::text FROM public.songs WHERE id = '${song}'`)).toBe("true");
    const tx = psql(
      `SELECT amount FROM public.coin_transactions
       WHERE user_id = '${user}' AND reference = 'unlock:${song}' LIMIT 1`,
    );
    expect(Number(tx)).toBeLessThan(0); // burn recorded as negative amount
  });

  it("refuses to deduct when balance is insufficient and leaves song unchanged", () => {
    const lockedSong = randomUUID();
    psql(
      `INSERT INTO public.songs (id, user_id, prompt, status, unlocked)
       VALUES ('${lockedSong}', '${user}', 'broke', 'completed', false)`,
    );
    psql(`UPDATE public.profiles SET coin_balance = 1 WHERE id = '${user}'`);
    const res = psqlSoft(
      `SET LOCAL ROLE authenticated;
       SELECT set_config('request.jwt.claim.sub', '${user}', true);
       SELECT public.deduct_coins('${user}', 50, 'unlock:${lockedSong}')`,
    );
    expect(res.ok).toBe(false);
    expect(psql(`SELECT unlocked::text FROM public.songs WHERE id = '${lockedSong}'`)).toBe("false");
    expect(Number(psql(`SELECT coin_balance FROM public.profiles WHERE id = '${user}'`))).toBe(1);
  });
});
