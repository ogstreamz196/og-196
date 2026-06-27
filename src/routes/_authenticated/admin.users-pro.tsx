import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Merged into /admin/users — keep route as a guarded redirect so old links still work.
export const Route = createFileRoute("/_authenticated/admin/users-pro")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: () => <Navigate to="/admin/users" replace />,
});
