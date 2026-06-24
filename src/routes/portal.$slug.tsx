import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/$slug")({
  beforeLoad: () => {
    throw redirect({ to: "/library" });
  },
});
