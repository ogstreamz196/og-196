import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
import { randomUUID } from "crypto";

/**
 * Regression test: when a cashback row points at a referee_id that no longer
 * has a matching public.profiles row (deleted account, orphaned data, etc.),
 * get_referral_summary must still return that row with a safe display label
 * ("Referred user") instead of leaking NULL or crashing the page.
 */

function canSeed(): boolean {
  if (!process.env.PGHOST) return false;
  try {
    const out = execFileSync(
      "psql",
      ["-tA", "-c", "SELECT has_schema_privilege(current_user, 'auth', 'USAGE')"],
      { encoding: "utf8" },
    ).trim();
    return out === "t";
  } catch {
    return false;
  }
}
const HAS_DB = canSeed();

function psql(sql: string): string {
  return execFileSync("psql", ["-tA", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
  }).trim();
}

function asUser(uid: string, sql: string): string {
  const wrapped = `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', true); ${sql}`;
  return execFileSync(
    "psql",
    ["-tA", "-v", "ON_ERROR_STOP=1", "-c", `BEGIN; ${wrapped}; COMMIT;`],
    { encoding: "utf8" },
  ).trim();
}

describe.skipIf(!HAS_DB)("get_referral_summary fallback", () => {
  const referrer = randomUUID();
  const orphanReferee = randomUUID(); // never inserted into profiles

  beforeAll(() => {
    psql(
      `INSERT INTO auth.users (id, email, instance_id, aud, role)
       VALUES ('${referrer}', 'orph-${referrer}@test.local',
               '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
       ON CONFLICT (id) DO NOTHING`,
    );
    psql(
      `INSERT INTO public.profiles (id, email, display_name, coin_balance)
       VALUES ('${referrer}', 'orph-${referrer}@test.local',
               'Orphan Referrer', 0)
       ON CONFLICT (id) DO NOTHING`,
    );
    // Insert a cashback transaction whose reference points at a referee
    // that does NOT exist in public.profiles.
    psql(
      `INSERT INTO public.coin_transactions (user_id, amount, type, reference)
       VALUES ('${referrer}', 7, 'referral_cashback',
               'referee:${orphanReferee}|burn:70|ref:test_orphan')`,
    );
  });

  afterAll(() => {
    psql(
      `DELETE FROM public.coin_transactions
       WHERE user_id = '${referrer}' AND reference LIKE '%${orphanReferee}%'`,
    );
  });

  it("falls back to a safe label when the referee profile is missing", () => {
    const json = asUser(referrer, `SELECT public.get_referral_summary()::text`);
    const summary = JSON.parse(json);
    const orphan = (summary.recent as Array<{
      referee_id: string | null;
      referee_name: string | null;
      amount: number;
    }>).find((r) => r.referee_id === orphanReferee);

    expect(orphan).toBeTruthy();
    expect(orphan!.amount).toBe(7);
    // Never NULL — the SQL COALESCE ladder must hand back a non-empty label.
    expect(orphan!.referee_name).toBeTruthy();
    expect(typeof orphan!.referee_name).toBe("string");
    expect(["Referred user", "Unknown", "Developer"]).toContain(
      orphan!.referee_name,
    );
  });
});
