import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CardTxRow = {
  id: string;
  created: string;
  paymentIntent: string | null;
  category: string;
  description: string;
  customerName: string | null;
  customerEmail: string | null;
  currency: string;
  gross: number;
  fee: number;
  net: number;
  refunded: number;
  status: string;
  method: string;
  last4: string | null;
  receiptUrl: string | null;
};

function categorise(c: any): string {
  const d = String(c.description ?? "").toLowerCase();
  const meta = { ...(c.metadata ?? {}), ...(c.payment_intent?.metadata ?? {}) };
  const bundle = String(meta.bundleId ?? "");
  if (meta.kind === "track_unlock" || d.includes("track unlock")) return "Track unlock";
  if (bundle.startsWith("store:")) return "Store item";
  if (bundle.includes("vip") || d.includes("vip") || d.includes("subscription") || c.invoice)
    return "VIP subscription";
  if (bundle.startsWith("coins") || d.includes("coin")) return "Coin pack";
  return "Other";
}

export const listCardTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string }) => {
    if (isNaN(Date.parse(d.from)) || isNaN(Date.parse(d.to))) throw new Error("Invalid dates");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ rows: CardTxRow[] } | { error: string }> => {
    const [b, a] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "boss" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (!b.data && !a.data) return { error: "Forbidden" };
    try {
      const { createStripeClient } = await import("@/lib/stripe.server");
      const stripe = createStripeClient("live");
      const rows: CardTxRow[] = [];
      const iter = stripe.charges.list({
        limit: 100,
        created: {
          gte: Math.floor(Date.parse(data.from) / 1000),
          lte: Math.floor(Date.parse(data.to) / 1000),
        },
        expand: ["data.balance_transaction", "data.payment_intent"],
      });
      for await (const c of iter as any) {
        if (rows.length >= 2000) break;
        if (c.status !== "succeeded" && !c.refunded) continue;
        const bt = typeof c.balance_transaction === "object" ? c.balance_transaction : null;
        const card = c.payment_method_details?.card;
        const wallet = card?.wallet?.type;
        rows.push({
          id: c.id,
          created: new Date(c.created * 1000).toISOString(),
          paymentIntent: typeof c.payment_intent === "string" ? c.payment_intent : (c.payment_intent?.id ?? null),
          category: categorise(c),
          description: c.description || c.payment_intent?.description || categorise(c),
          customerName: c.billing_details?.name ?? null,
          customerEmail: c.billing_details?.email ?? c.receipt_email ?? null,
          currency: String(c.currency ?? "gbp").toUpperCase(),
          gross: (c.amount ?? 0) / 100,
          fee: (bt?.fee ?? 0) / 100,
          net: bt ? (bt.net ?? 0) / 100 : (c.amount ?? 0) / 100,
          refunded: (c.amount_refunded ?? 0) / 100,
          status: c.disputed
            ? "Disputed"
            : c.refunded
              ? "Refunded"
              : c.amount_refunded > 0
                ? "Partially refunded"
                : "Succeeded",
          method: wallet ? `${wallet.replace("_", " ")} (${card?.brand ?? "card"})` : (card?.brand ?? c.payment_method_details?.type ?? "card"),
          last4: card?.last4 ?? null,
          receiptUrl: c.receipt_url ?? null,
        });
      }
      return { rows };
    } catch (e) {
      console.error("listCardTransactions", e);
      return { error: "Couldn't load transactions from the payment provider." };
    }
  });
