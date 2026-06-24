import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/portals")({
  beforeLoad: () => {
    throw redirect({ to: "/library" });
  },
});
