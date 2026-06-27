import { cn } from "@/lib/utils";

/**
 * Three-dot "is typing / is working" indicator.
 * Centralizes the bouncing-primary-dots pattern used across messenger and song
 * generation UIs so dot size, color, and stagger stay consistent everywhere.
 */
export function TypingDots({
  size = "md",
  className,
  "aria-label": ariaLabel = "Loading",
}: {
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}) {
  const dot =
    size === "sm"
      ? "h-1.5 w-1.5"
      : "h-2 w-2";
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-1", className)}
    >
      <span className={cn(dot, "rounded-full bg-primary animate-bounce [animation-delay:-0.3s]")} />
      <span className={cn(dot, "rounded-full bg-primary animate-bounce [animation-delay:-0.15s]")} />
      <span className={cn(dot, "rounded-full bg-primary animate-bounce")} />
    </span>
  );
}
