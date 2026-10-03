import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVipPassStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: purchase } = await supabaseAdmin
      .from("vip_pass_purchases")
      .select("credential_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    // VIP members (paid or free trial) get the Vault pass free for a limited time.
    const [{ data: vipRole }, { data: prof }] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .in("role", ["vip", "admin"])
        .limit(1),
      supabaseAdmin
        .from("profiles")
        .select("vip_trial_ends_at")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);
    const trialEnds = (prof as { vip_trial_ends_at?: string | null } | null)?.vip_trial_ends_at;
    const vipFree =
      (vipRole?.length ?? 0) > 0 || (!!trialEnds && new Date(trialEnds).getTime() > Date.now());
    let username: string | null = null;
    let password: string | null = null;
    const { data: creds } = await supabaseAdmin
      .from("vip_pass_credentials")
      .select("username,password")
      .eq("active", true)
      .order("created_at", { ascending: true });
    const available = creds?.length ?? 0;
    const owned = !!purchase || vipFree;
    if (owned && creds && creds.length > 0) {
      // Rotate the shown login every 2 hours; everyone sees the same one
      // in the same window, including the same user on repeat views.
      const windowIndex = Math.floor(Date.now() / (2 * 60 * 60 * 1000));
      const cred = creds[windowIndex % creds.length];
      username = cred.username;
      password = cred.password;
    }
    return { owned, vipFree: vipFree && !purchase, username, password, available };
  });

export const purchaseVipPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("purchase_vip_pass_for_user", {
      p_user: context.userId,
    });
    if (error) throw new Error(error.message);
    return data as { ok: boolean; already_owned: boolean; username: string; password: string };
  });
