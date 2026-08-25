import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: ReactNode;
  /** Stable key for persisting open state in localStorage. */
  storageKey: string;
  defaultOpen?: boolean;
  subtitle?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Lightweight collapsible wrapper used to make every Admin Console panel
 * expandable/collapsible. Persists the open/closed state per `storageKey`
 * so the dashboard remembers each section between visits.
 */
export function AdminCollapsible({
  title,
  storageKey,
  defaultOpen = false,
  subtitle,
  className,
  children,
}: Props) {
  const key = `admin-collapsible:${storageKey}`;
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) setOpen(saved === "1");
    } catch { /* ignore */ }
    hydrated.current = true;
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(key, open ? "1" : "0"); } catch { /* ignore */ }
  }, [key, open]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      if (detail && typeof detail.open === "boolean") setOpen(detail.open);
    };
    // Accordion: opening one section collapses the others.
    const exclusive = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key && detail.key !== key) setOpen(false);
    };
    window.addEventListener("admin-collapsible:set-all", handler);
    window.addEventListener("admin-collapsible:opened", exclusive);
    return () => {
      window.removeEventListener("admin-collapsible:set-all", handler);
      window.removeEventListener("admin-collapsible:opened", exclusive);
    };
  }, [key]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        window.dispatchEvent(
          new CustomEvent("admin-collapsible:opened", { detail: { key } }),
        );
      }
      return next;
    });
  }

  return (
    <section
      className={cn(
        "mb-4 overflow-hidden rounded-2xl border border-border bg-card/60 shadow-card",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
      >

        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight">{title}</div>
          {subtitle && (
            <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/60 p-2 sm:p-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
