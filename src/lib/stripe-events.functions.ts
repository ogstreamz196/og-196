import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StripeEventRow = {
  eventId: string;
  eventType: string;
  environment: string;
  objectId: string | null;
  bundleId: string | null;
  status: string | null;
  receivedAt: string;
  credited: {
    txId: string;
    userId: string;
    userEmail: string | null;
    amount: number;
    createdAt: string;
  } | null;
};

export const listStripeWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StripeEventRow[]> => {
    const supabase = context.supabase as any;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: events, error } = await supabaseAdmin
      .from("stripe_webhook_events")
      .select("event_id,event_type,environment,payload_summary,received_at")
      .order("received_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);

    const refs: string[] = [];
    const rows = (events ?? []).map((e: any) => {
      const summary = (e.payload_summary ?? {}) as Record<string, unknown>;
      const objectId = (summary.objectId as string | undefined) ?? null;
      const reference = objectId ? `stripe:${e.environment}:${objectId}` : null;
      if (reference) refs.push(reference);
      return {
        eventId: e.event_id as string,
        eventType: e.event_type as string,
        environment: e.environment as string,
        objectId,
        bundleId: (summary.bundleId as string | undefined) ?? null,
        status: (summary.status as string | undefined) ?? null,
        receivedAt: e.received_at as string,
        reference,
      };
    });

    let txByRef = new Map<string, any>();
    if (refs.length) {
      const { data: txs } = await supabaseAdmin
        .from("coin_transactions")
        .select("id,user_id,amount,reference,created_at")
        .in("reference", refs);
      const userIds = Array.from(new Set((txs ?? []).map((t: any) => t.user_id)));
      const emails = new Map<string, string | null>();
      if (userIds.length) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id,email")
          .in("id", userIds);
        (profs ?? []).forEach((p: any) => emails.set(p.id, p.email ?? null));
      }
      txByRef = new Map(
        (txs ?? []).map((t: any) => [
          t.reference,
          {
            txId: t.id,
            userId: t.user_id,
            userEmail: emails.get(t.user_id) ?? null,
            amount: t.amount,
            createdAt: t.created_at,
          },
        ]),
      );
    }

    return rows.map(({ reference, ...r }) => ({
      ...r,
      credited: reference ? txByRef.get(reference) ?? null : null,
    }));
  });
