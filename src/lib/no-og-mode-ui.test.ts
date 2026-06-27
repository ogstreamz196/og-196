import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Hard guard: the standalone "OG Mode" UI feature was removed and replaced by
 * the single Foul Mouth toggle. The backend still carries a derived tone
 * called `OgMode` (values "og" | "safe"), so this audit bans UI-layer
 * references only — hooks, components, profile columns, and toggle UI.
 *
 * If this test fails, you re-introduced OG Mode UI somewhere. Delete it and
 * derive the tone from `useFoulMouth()` instead.
 */

const SRC = join(__dirname, "..");

// UI-layer patterns that MUST NOT exist anywhere in src/.
const BANNED: RegExp[] = [
  /\buseOgMode\b/,
  /\bOgModeToggle\b/,
  /\bOgModeProvider\b/,
  /\bOgModeContext\b/,
  /\bog_mode\b/,           // profile column / preference key
  /["']og-mode["']/,        // route segment / storage key
];

const SKIP_DIRS = new Set(["__snapshots__", "node_modules", "dist", "build"]);
const SKIP_FILES = /\.(gen|d)\.[tj]sx?$/;
// This test file itself contains the banned patterns as literals.
const ALLOWLIST = new Set<string>(["lib/no-og-mode-ui.test.ts"]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry) && !SKIP_FILES.test(entry)) acc.push(full);
  }
  return acc;
}

describe("OG Mode UI removal audit", () => {
  it("has no UI-layer OG Mode references (hooks, components, columns, route keys)", () => {
    const files = walk(SRC);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(SRC, file).replaceAll("\\", "/");
      if (ALLOWLIST.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const re of BANNED) {
        const m = re.exec(src);
        if (m) {
          const line = src.slice(0, m.index).split("\n").length;
          offenders.push(`${rel}:${line} — matched ${re}`);
        }
      }
    }
    expect(
      offenders,
      `OG Mode UI has been removed. Derive tone from useFoulMouth() instead.\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
