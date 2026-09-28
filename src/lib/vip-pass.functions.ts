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
    if (purchase) {
      const { data: cred } = await supabaseAdmin
        .from("vip_pass_credentials")
        .select("username,password")
        .eq("id", purchase.credential_id)
        .maybeSingle();
      username = cred?.username ?? null;
      password = cred?.password ?? null;
    }
    const { count } = await supabaseAdmin
      .from("vip_pass_credentials")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    return { owned: !!purchase, username, password, available: count ?? 0 };
  });

export const purchaseVipPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("purchase_vip_pass_for_user", { p_user: context.userId });
    if (error) throw new Error(error.message);
    return data as { ok: boolean; already_owned: boolean; username: string; password: string };
  });
