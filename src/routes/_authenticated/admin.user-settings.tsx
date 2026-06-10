import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /admin/users — per-user settings now live at /admin/users/$userId.
export const Route = createFileRoute("/_authenticated/admin/user-settings")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/users" });
  },
  component: () => null,
});
