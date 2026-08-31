import { cn } from "@/lib/utils";

/** Animated VU meter — decorative studio flavour for the Music Hub header. */
export function StudioMeter({
  active,
  bars = 7,
  className,
}: {
  active: boolean;
  bars?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("flex h-6 items-end gap-[3px]", className)}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] rounded-full bg-gradient-to-t from-primary/50 to-primary",
            active ? "studio-vu-bar" : "opacity-30",
          )}
          style={{
            height: `${40 + ((i * 37) % 60)}%`,
            animationDelay: `${(i * 0.13).toFixed(2)}s`,
            animationDuration: `${(0.9 + ((i * 7) % 5) / 10).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Small labelled status LED used on the console rail. */
export function StudioLed({
  label,
  tone = "ok",
  pulse = false,
}: {
  label: string;
  tone?: "ok" | "busy" | "idle";
  pulse?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "ok" && "bg-emerald-400 text-emerald-400",
          tone === "busy" && "bg-primary text-primary",
          tone === "idle" && "bg-white/25 text-white/25",
          pulse && "studio-led",
        )}
      />
      {label}
    </span>
  );
}
