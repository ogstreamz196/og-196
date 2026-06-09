import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Send everyone to the dashboard; _authenticated layout handles auth redirect.
    throw redirect({ to: "/" as never });
  },
  component: () => null,
});
