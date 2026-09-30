import { Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type LibraryFilterMode = "all" | "unlocked" | "styles";

function CountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        "ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums",
        active ? "bg-black/25 text-primary-foreground" : "bg-primary/15 text-primary",
      )}
    >
      {count}
    </span>
  );
}

export function LibraryFilters({
  mode,
  onModeChange,
  styles,
  selectedStyle,
  onStyleChange,
  allCount,
  unlockedCount,
}: {
  mode: LibraryFilterMode;
  onModeChange: (mode: LibraryFilterMode) => void;
  styles: string[];
  selectedStyle: string | null;
  onStyleChange: (style: string | null) => void;
  /** Item counts shown as badges next to All / Unlocked. */
  allCount?: number;
  unlockedCount?: number;
}) {
  return (
    <div aria-label="Filter tracks" className="grid grid-cols-3 gap-2">
      <Button
        type="button"
        variant={mode === "all" ? "default" : "outline"}
        size="sm"
        aria-pressed={mode === "all"}
        onClick={() => onModeChange("all")}
        className="min-w-0 rounded-full"
      >
        All
        {typeof allCount === "number" && <CountBadge count={allCount} active={mode === "all"} />}
      </Button>
      <Button
        type="button"
        variant={mode === "unlocked" ? "default" : "outline"}
        size="sm"
        aria-pressed={mode === "unlocked"}
        onClick={() => onModeChange("unlocked")}
        className="min-w-0 rounded-full"
      >
        Unlocked
        {typeof unlockedCount === "number" && (
          <CountBadge count={unlockedCount} active={mode === "unlocked"} />
        )}
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={mode === "styles" ? "default" : "outline"}
            size="sm"
            aria-pressed={mode === "styles"}
            className="min-w-0 rounded-full px-2"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="truncate">{selectedStyle || "Styles"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2">
          <p className="px-2 pb-2 text-xs font-bold uppercase text-muted-foreground">
            Choose a style
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {styles.map((style) => (
              <Button
                key={style}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onStyleChange(style);
                  onModeChange("styles");
                }}
                className={cn("w-full justify-between", selectedStyle === style && "text-primary")}
              >
                <span className="truncate">{style}</span>
                {selectedStyle === style && <Check className="h-4 w-4" />}
              </Button>
            ))}
            {styles.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">No styles available yet.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}