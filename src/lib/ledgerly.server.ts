// Server-only Ledgerly bookkeeping sync. The API key never leaves the server.
const ENDPOINT = "https://ledger.ogstreamz.co.uk/api/public/v1/transactions";

export type LedgerlySale = {
  amount: number; // GBP
  description: string;
  reference: string;
  externalId: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function postLedgerly(apiKey: string, sale: LedgerlySale, timeoutMs = 6000) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      amount: Math.round(sale.amount * 100) / 100,
      description: sale.description,
      reference: sale.reference,
      external_id: sale.externalId,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: text.slice(0, 300) };
}

/** Never throws — failures are logged for admin review. */
export async function syncSaleToLedgerly(sale: LedgerlySale): Promise<void> {
  try {
    const db = await admin();
    const { data } = await db.from("ledgerly_settings").select("enabled, api_key").eq("id", 1).maybeSingle();
    if (!data?.enabled || !data.api_key) return;
    const r = await postLedgerly(data.api_key, sale);
    if (!r.ok) {
      console.error(JSON.stringify({ scope: "ledgerly", msg: "sync failed", status: r.status, body: r.body, externalId: sale.externalId }));
      await db.from("ledgerly_settings").update({ last_error: `HTTP ${r.status} for ${sale.externalId}: ${r.body}` }).eq("id", 1);
    } else {
      console.log(JSON.stringify({ scope: "ledgerly", msg: "synced", externalId: sale.externalId }));
    }
  } catch (e) {
    console.error(JSON.stringify({ scope: "ledgerly", msg: "sync error", error: String(e), externalId: sale.externalId }));
  }
}
