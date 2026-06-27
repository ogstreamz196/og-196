import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { META, POOLS, type Category } from "@/lib/library-utils";

interface CategoryCardProps {
  cat: Category;
  value: string | undefined;
  chips: string[];
  onSelect: (v: string) => void;
  onPickChip: (v: string) => void;
  onRefresh: () => void;
}

export function CategoryCard({
  cat,
  value,
  chips,
  onSelect,
  onPickChip,
  onRefresh,
}: CategoryCardProps) {
  const meta = META[cat];
  const Icon = meta.icon;
  return (
    <div className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-card/70 p-5 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.55)] ring-1 ring-white/5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] sm:p-7">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gradient-to-br ${meta.gradient} opacity-90 blur-2xl`}
      />
      <div className="relative space-y-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-xl ${meta.iconBg}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className={"font-bungee text-xl sm:text-2xl uppercase"}>
              {meta.emoji} {meta.label}
            </div>

            <div className="mt-1.5 text-base font-semibold text-foreground">
              {value ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${meta.accent}`} />
                  {value}
                </span>
              ) : (
                <span className="text-muted-foreground">{meta.helper}</span>
              )}
            </div>
          </div>
        </div>

        <Select value={value ?? ""} onValueChange={onSelect}>
          <SelectTrigger className="h-12 w-full rounded-xl border-white/10 bg-background/50 text-base font-semibold">
            <SelectValue placeholder={meta.placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {POOLS[cat].map((opt) => (
              <SelectItem key={opt} value={opt} className="text-base">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bungee text-base sm:text-lg uppercase text-muted-foreground">
              Quick picks
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              aria-label={`Shuffle ${meta.label} suggestions`}
              className={`h-8 shrink-0 gap-1.5 px-2.5 text-xs font-bold ${meta.accent} hover:bg-white/5`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Shuffle
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => {
              const active = value === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onPickChip(chip)}
                  className={
                    "rounded-full border px-3.5 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 " +
                    (active
                      ? meta.chipActive
                      : "border-white/10 bg-white/[0.04] text-foreground/90 hover:border-white/25 hover:bg-white/10")
                  }
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
