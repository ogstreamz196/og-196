import { createFileRoute, Navigate } from "@tanstack/react-router";

// Merged into /admin/users — keep route as a redirect so old links still work.
export const Route = createFileRoute("/_authenticated/admin/users-pro")({
  component: () => <Navigate to="/admin/users" replace />,
});
