import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Repo-wide guard: any user-facing toggle copy must say "Turn on" / "Turn off"
// rather than "Enable" / "Disable" / "Switch on" / "Switch off" / "Toggle on"
// / "Toggle off". This keeps every switch self-describing — the label always
// states the action the next click will take, matching the shared <Switch />
// primitive (see src/components/ui/switch.tsx + switch-a11y.test.ts).
//
// We scan source files (excluding tests, generated files, and the Supabase
// type dump) and flag matches inside JSX text nodes or string-literal attribute
// values (aria-label, title, label, placeholder, description, desc, tooltip,
// content). Identifiers like `setEnabled`, `rawEnabled`, code comments, and
// non-toggle copy (e.g. "Enabled at: <date>") are intentionally not flagged.

const SRC = join(__dirname, "..");
const BANNED = ["Enable", "Disable", "Switch on", "Switch off", "Toggle on", "Toggle off"];
// Attributes whose string values are user-facing toggle copy.
const ATTRS = [
  "aria-label", "title", "label", "placeholder",
  "description", "desc", "tooltip", "content",
];
const SKIP_DIRS = new Set(["__snapshots__", "node_modules"]);
const SKIP_FILES = /\.(test|spec|gen|d)\.[tj]sx?$/;
// Files whose toggle copy is intentionally exempt (none right now — keep this
// list empty so new violations always fail loudly).
const ALLOWLIST: string[] = [];

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

function stripComments(src: string): string {
  // Drop /* … */ and // … line comments so doc-comments and code notes are exempt.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function bannedRe(): RegExp {
  // Match a banned phrase as a whole word/phrase, case-sensitive.
  return new RegExp(`\\b(?:${BANNED.join("|")})\\b`);
}

function findViolations(src: string): Array<{ snippet: string; phrase: string }> {
  const code = stripComments(src);
  const out: Array<{ snippet: string; phrase: string }> = [];
  const re = bannedRe();

  // 1. Attribute values: aria-label="…", title={"…"}, etc.
  const attrRe = new RegExp(
    `(?:${ATTRS.join("|")})\\s*=\\s*\\{?\\s*["\`]([^"\`]+)["\`]`,
    "g",
  );
  for (const m of code.matchAll(attrRe)) {
    const value = m[1];
    const hit = re.exec(value);
    if (hit) out.push({ snippet: m[0], phrase: hit[0] });
  }

  // 2. JSX text nodes: > some text < (only the visible content between tags).
  const textRe = />([^<>{}\n]{2,}?)</g;
  for (const m of code.matchAll(textRe)) {
    const text = m[1].trim();
    if (!text) continue;
    const hit = re.exec(text);
    if (hit) out.push({ snippet: text, phrase: hit[0] });
  }

  return out;
}

describe("toggle wording", () => {
  it("uses 'Turn on / Turn off' (no 'Enable / Disable / Switch on/off / Toggle on/off') in JSX copy", () => {
    const files = walk(SRC);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(SRC, file);
      if (ALLOWLIST.includes(rel)) continue;
      const src = readFileSync(file, "utf8");
      const hits = findViolations(src);
      for (const h of hits) {
        offenders.push(`${rel}: "${h.phrase}" in ${h.snippet.slice(0, 120)}`);
      }
    }
    expect(
      offenders,
      `Replace with "Turn on" / "Turn off":\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
