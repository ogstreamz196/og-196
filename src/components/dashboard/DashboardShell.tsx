import type { ReactNode } from "react";

export function DashboardShell({ title, children }: { title: string; children: ReactNode }) {
  return <section aria-label={title}>{children}</section>;
}
