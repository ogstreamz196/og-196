import { History } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Collapsed-by-default <details> panel used across admin "recent changes"
 * sections. Keeps the Show/Hide affordance and `data-testid` contract that
 * the admin-recent-changes Playwright assertion relies on.
 */
export function CollapsiblePanel({
  title,
  icon,
  count,
  children,
  className,
  testId = "admin-recent-changes",
  defaultOpen = false,
}: {
  title: ReactNode;
  icon?: ReactNode;
  count?: number;
  children: ReactNode;
  className?: string;
  testId?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      data-testid={testId}
      open={defaultOpen}
      className={cn("group rounded-xl border border-border bg-background/40", className)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
        {icon ?? <History className="h-4 w-4" />}
        <span>
          {title}
          {typeof count === "number" && <> ({count})</>}
        </span>
        <span className="ml-auto text-xs opacity-70 group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs opacity-70 group-open:inline">Hide</span>
      </summary>
      <div className="border-t border-border">{children}</div>
    </details>
  );
}
