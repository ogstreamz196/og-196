import { createFileRoute, redirect } from "@tanstack/react-router";

// Community has been merged into OG Messenger. Redirect to messenger with
// Live Chat Mode pre-enabled.
export const Route = createFileRoute("/_authenticated/community")({
  beforeLoad: () => {
    throw redirect({ to: "/messenger", search: { live: "1" } as never });
  },
  component: () => null,
});
