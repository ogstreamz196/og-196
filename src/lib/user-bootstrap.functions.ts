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
    const { userId, supabase, claims } = context;
    const email = typeof claims.email === "string" ? claims.email : "";
    const displayName = typeof claims.user_metadata === "object" && claims.user_metadata && "display_name" in claims.user_metadata
      ? String(claims.user_metadata.display_name ?? "")
      : email.split("@")[0] ?? "User";

    let ensuredProfile = false;
    let ensuredUserRole = false;
    let ensuredBossRole = false;

    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!existingProfile) {
      const { error } = await supabase.from("profiles").insert({
        id: userId,
        email,
        display_name: displayName || "User",
        coin_balance: 10,
      });
      if (error) throw error;

      const { error: txError } = await supabase.from("coin_transactions").insert({
        user_id: userId,
        amount: 10,
        type: "bonus",
        reference: "welcome",
      });
      if (txError) throw txError;
      ensuredProfile = true;
    }

    const { data: roleRows, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) throw rolesError;

    const roles = new Set((roleRows ?? []).map((row) => row.role));

    if (!roles.has("user")) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "user" });
      if (error && !error.message.toLowerCase().includes("duplicate")) throw error;
      ensuredUserRole = true;
    }

    if (email.toLowerCase() === BOSS_EMAIL && !roles.has("admin")) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error && !error.message.toLowerCase().includes("duplicate")) throw error;
      ensuredBossRole = true;
    }

    return { ensuredProfile, ensuredUserRole, ensuredBossRole };
  });