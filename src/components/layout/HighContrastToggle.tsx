import { useEffect, useState } from "react";
import { Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEY = "og:high-contrast";

export function HighContrastToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
    setOn(saved);
    document.documentElement.classList.toggle("hc", saved);
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    document.documentElement.classList.toggle("hc", next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Disable high contrast" : "Enable high contrast"}
      title={on ? "High contrast: ON" : "High contrast: OFF"}
      className={cn(
        "h-9 w-9 hover:bg-white/5",
        on && "bg-primary/20 text-primary ring-2 ring-primary/60",
        className,
      )}
    >
      <Contrast className="h-4 w-4" />
    </Button>
  );
}
