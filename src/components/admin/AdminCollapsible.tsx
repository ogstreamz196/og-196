import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: ReactNode;
  /** Stable key for persisting open state in localStorage. */
  storageKey: string;
  defaultOpen?: boolean;
  subtitle?: ReactNode;
  className?: string;
  /** Sections sharing a group close each other when opened. */
  group?: string;
  children: ReactNode;
}

/**
 * Collapsible admin panel. Opening one closes the others in the same group.
 */
export function AdminCollapsible({
  title,
  storageKey,
  defaultOpen = false,
  subtitle,
  className,
  group = "default",
  children,
}: Props) {
  const key = `admin-collapsible:${storageKey}`;
  const [open, setOpen] = useState<boolean>(defaultOpen);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      if (detail && typeof detail.open === "boolean") setOpen(detail.open);
    };
    // Accordion: opening one section collapses the others in the same group.
    const exclusive = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string; group: string }>).detail;
      if (detail?.key && detail.key !== key && detail.group === group) setOpen(false);
    };
    window.addEventListener("admin-collapsible:set-all", handler);
    window.addEventListener("admin-collapsible:opened", exclusive);
    return () => {
      window.removeEventListener("admin-collapsible:set-all", handler);
      window.removeEventListener("admin-collapsible:opened", exclusive);
    };
  }, [key, group]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        window.dispatchEvent(
          new CustomEvent("admin-collapsible:opened", { detail: { key, group } }),
        );
      }
      return next;
    });
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors",
        open ? "border-primary/40" : "border-border",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1">
          <div className="break-words text-[15px] font-medium leading-snug">{title}</div>
          {subtitle && (
            <div className="mt-0.5 break-words text-xs leading-snug text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180 text-primary",
          )}
        />
      </button>
      {open && (
        <div className="min-w-0 overflow-x-auto border-t border-border p-3 sm:p-4">{children}</div>
      )}
    </section>
  );
}
