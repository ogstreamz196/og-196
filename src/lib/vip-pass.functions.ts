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
    let username: string | null = null;
    let password: string | null = null;
    const { data: creds } = await supabaseAdmin
      .from("vip_pass_credentials")
      .select("username,password")
      .eq("active", true)
      .order("created_at", { ascending: true });
    const available = creds?.length ?? 0;
    if (purchase && creds && creds.length > 0) {
      // Rotate the shown login every 2 hours; everyone sees the same one
      // in the same window, including the same user on repeat views.
      const windowIndex = Math.floor(Date.now() / (2 * 60 * 60 * 1000));
      const cred = creds[windowIndex % creds.length];
      username = cred.username;
      password = cred.password;
    }
    return { owned: !!purchase, username, password, available };
  });

export const purchaseVipPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("purchase_vip_pass_for_user", { p_user: context.userId });
    if (error) throw new Error(error.message);
    return data as { ok: boolean; already_owned: boolean; username: string; password: string };
  });
