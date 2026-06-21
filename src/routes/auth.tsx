import { createFileRoute, redirect } from "@tanstack/react-router";

// Auth page merged into /welcome — redirect any /auth visit (including
// post-sign-out fallbacks and legacy links) to the welcome page.
export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/welcome", replace: true });
  },
  component: () => null,
});
