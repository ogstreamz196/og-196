/**
 * Source-level guard test for the `song-url` edge function.
 *
 * The full-track download endpoint MUST NOT return a signed URL unless an
 * `unlocked_songs` ledger row exists for (user_id, song_id). This test pins
 * the critical guards in source so a future edit cannot silently regress the
 * authorization checks (which would expose the full HQ audio for free).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(process.cwd(), "supabase/functions/song-url/index.ts"),
  "utf8",
);

describe("song-url edge function guards", () => {
  it("requires an authenticated user", () => {
    expect(SRC).toMatch(/requireUser\(req\)/);
    expect(SRC).toMatch(/auth\.error/);
  });

  it("scopes the song lookup to the caller (owner-only)", () => {
    expect(SRC).toMatch(/song\.user_id\s*!==\s*user\.id/);
  });

  it("blocks mode='full' without an unlocked_songs row", () => {
    // The query against unlocked_songs filtered by both user_id + song_id…
    expect(SRC).toMatch(/from\(["']unlocked_songs["']\)/);
    expect(SRC).toMatch(/\.eq\(["']user_id["'],\s*user\.id\)/);
    expect(SRC).toMatch(/\.eq\(["']song_id["'],\s*song_id\)/);
    // …and a 403 when the row is missing.
    expect(SRC).toMatch(/if\s*\(!unlockRow\)[^;]*403/);
  });

  it("never serves audio_path in preview mode", () => {
    // Preview branch must use sample_path, full branch must use audio_path.
    expect(SRC).toMatch(
      /mode\s*===\s*["']full["']\s*\?\s*song\.audio_path[^:]*:\s*song\.sample_path/,
    );
  });

  it("places the unlock check before signing the URL", () => {
    const unlockIdx = SRC.indexOf("unlocked_songs");
    const signIdx = SRC.indexOf("createSignedUrl");
    expect(unlockIdx).toBeGreaterThan(-1);
    expect(signIdx).toBeGreaterThan(unlockIdx);
  });
});
