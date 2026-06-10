import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type BootstrapResult = {
  ensuredProfile: boolean;
  ensuredUserRole: boolean;
  ensuredBossRole: boolean;
};

const BOSS_EMAIL = "ogstreamz196@gmail.com";

export const ensureCurrentUserBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BootstrapResult> => {
    const { userId, claims } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = typeof claims.email === "string" ? claims.email : "";
    const userMetadata = typeof claims.user_metadata === "object" && claims.user_metadata
      ? claims.user_metadata as Record<string, unknown>
      : null;
    const displayName = userMetadata && typeof userMetadata.display_name === "string"
      ? userMetadata.display_name
      : email.split("@")[0] ?? "User";

    let ensuredProfile = false;
    let ensuredUserRole = false;
    let ensuredBossRole = false;

    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!existingProfile) {
      const { error } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        email,
        display_name: displayName || "User",
        coin_balance: 10,
      });
      if (error) throw error;

      const { error: txError } = await supabaseAdmin.from("coin_transactions").insert({
        user_id: userId,
        amount: 10,
        type: "bonus",
        reference: "welcome",
      });
      if (txError) throw txError;
      ensuredProfile = true;
    }

    const { data: roleRows, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) throw rolesError;

    const roles = new Set((roleRows ?? []).map((row) => row.role));

    if (!roles.has("user")) {
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "user" });
      if (error && error.code !== "23505") throw error;
      ensuredUserRole = true;
    }

    if (email.toLowerCase() === BOSS_EMAIL && !roles.has("admin")) {
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error && error.code !== "23505") throw error;
      ensuredBossRole = true;
    }

    return { ensuredProfile, ensuredUserRole, ensuredBossRole };
  });