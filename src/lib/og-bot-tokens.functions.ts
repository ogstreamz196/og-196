import { createServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * OG Bot tokens live in a private Storage bucket as an xlsx workbook.
 * This file is the single source of truth for token auth — DO NOT
 * re-introduce a Postgres table lookup.
 *
 * Storage location:
 *   - Bucket: og-bot-tokens (private)
 *   - Path:   og-bot-tokens.xlsx
 *   - URI:    storage://og-bot-tokens/og-bot-tokens.xlsx
 *
 * Schema (sheet "tokens"):
 *   user_id | token | created_at | expires_at | revoked | last_used_at | notes
 */

const BUCKET = "og-bot-tokens";
const OBJECT_PATH = "og-bot-tokens.xlsx";
const SHEET_NAME = "tokens";

export interface OgBotTokenRow {
  user_id: string;
  token: string;
  created_at: string | null;
  expires_at: string | null;
  revoked: boolean;
  last_used_at: string | null;
  notes: string | null;
}

function rowToToken(r: Record<string, unknown>): OgBotTokenRow {
  const revokedRaw = r.revoked;
  const revoked =
    revokedRaw === true ||
    String(revokedRaw ?? "").toLowerCase() === "true" ||
    String(revokedRaw ?? "") === "1";
  return {
    user_id: String(r.user_id ?? ""),
    token: String(r.token ?? ""),
    created_at: r.created_at ? String(r.created_at) : null,
    expires_at: r.expires_at ? String(r.expires_at) : null,
    revoked,
    last_used_at: r.last_used_at ? String(r.last_used_at) : null,
    notes: r.notes ? String(r.notes) : null,
  };
}

async function loadWorkbook(): Promise<{ wb: XLSX.WorkBook; rows: OgBotTokenRow[] }> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(OBJECT_PATH);
  if (error || !data) throw new Error("og_bot_tokens workbook missing");
  const buf = new Uint8Array(await data.arrayBuffer());
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[SHEET_NAME] ?? wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return { wb, rows: raw.map(rowToToken) };
}

async function saveWorkbook(wb: XLSX.WorkBook, rows: OgBotTokenRow[]): Promise<void> {
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      "user_id",
      "token",
      "created_at",
      "expires_at",
      "revoked",
      "last_used_at",
      "notes",
    ],
  });
  wb.Sheets[SHEET_NAME] = sheet;
  if (!wb.SheetNames.includes(SHEET_NAME)) wb.SheetNames.push(SHEET_NAME);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(OBJECT_PATH, out, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
  if (error) throw new Error(`Failed to persist token workbook: ${error.message}`);
}

export type VerifyResult =
  | { ok: true; user_id: string }
  | { ok: false; reason: "invalid" | "revoked" | "expired" | "missing" };

export async function verifyOgBotTokenInternal(token: string): Promise<VerifyResult> {
  const t = (token ?? "").trim();
  if (!t || !t.startsWith("ogb_")) return { ok: false, reason: "invalid" };

  let workbook: XLSX.WorkBook;
  let rows: OgBotTokenRow[];
  try {
    const loaded = await loadWorkbook();
    workbook = loaded.wb;
    rows = loaded.rows;
  } catch {
    return { ok: false, reason: "missing" };
  }

  const idx = rows.findIndex((r) => r.token === t);
  if (idx < 0) return { ok: false, reason: "invalid" };
  const row = rows[idx];

  if (row.revoked) return { ok: false, reason: "revoked" };
  if (row.expires_at) {
    const exp = Date.parse(row.expires_at);
    if (!Number.isNaN(exp) && exp < Date.now()) return { ok: false, reason: "expired" };
  }

  // Stamp last_used_at and persist. Best-effort — never fail auth on write error.
  try {
    rows[idx] = { ...row, last_used_at: new Date().toISOString() };
    await saveWorkbook(workbook, rows);
  } catch (err) {
    console.warn("verifyOgBotToken: failed to stamp last_used_at", err);
  }

  return { ok: true, user_id: row.user_id };
}

export const verifyOgBotToken = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (!data || typeof data.token !== "string") throw new Error("token required");
    return { token: data.token.slice(0, 200) };
  })
  .handler(async ({ data }) => verifyOgBotTokenInternal(data.token));
