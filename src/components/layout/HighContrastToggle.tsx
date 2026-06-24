import { useEffect, useState } from "react";
import { Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEY = "og:high-contrast";

export function HighContrastToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("hc");
  });

  useEffect(() => {
    // Sync if another tab toggled it
    function onStorage(e: StorageEvent) {
      if (e.key !== KEY) return;
      const next = e.newValue === "1";
      setOn(next);
      document.documentElement.classList.toggle("hc", next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
      aria-label={on ? "Turn off high contrast" : "Turn on high contrast"}
      title={on ? "Turn off high contrast" : "Turn on high contrast"}
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
