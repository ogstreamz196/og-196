import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/developer")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
