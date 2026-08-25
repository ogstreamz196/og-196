import { useState } from "react";
import { ChevronDown, History, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Song } from "@/components/SongCard";
import { cn } from "@/lib/utils";

type UiStatus = "queued" | "generating" | "ready" | "failed" | "cancelled";

const STATUS_META: Record<UiStatus, { label: string; className: string }> = {
  queued: { label: "Queued", className: "border-amber-400/50 bg-amber-500/15 text-amber-200" },
  generating: {
    label: "Generating",
    className: "border-primary/50 bg-primary/15 text-primary",
  },
  ready: { label: "Ready", className: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" },
  failed: {
    label: "Failed",
    className: "border-destructive/50 bg-destructive/15 text-destructive",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-white/15 bg-white/5 text-muted-foreground",
  },
};

/** Map raw DB statuses onto the five statuses shown to the user. */
export function toUiStatus(raw: string | null | undefined): UiStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "completed":
    case "complete":
    case "ready":
      return "ready";
    case "failed":
    case "error":
      return "failed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "processing":
    case "generating":
    case "rendering":
      return "generating";
    default:
      return "queued";
  }
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GenerationHistory({
  songs,
  loading,
}: {
  songs: Song[];
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const visible = open ? songs : songs.slice(0, 4);

  return (
    <section
      aria-labelledby="generation-history-heading"
      className="rounded-2xl border border-white/10 bg-card/60 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="generation-history-heading"
          className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground"
        >
          <History className="h-3.5 w-3.5" />
          Generation history
        </h2>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {songs.length === 0 && !loading ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No generations yet — your first track will show up here.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-white/5">
          {visible.map((s) => {
            const st = toUiStatus(s.status);
            const meta = STATUS_META[st];
            return (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <Link
                  to="/library/$songId"
                  params={{ songId: s.id }}
                  className="min-w-0 flex-1 truncate text-sm font-bold hover:text-primary"
                >
                  {s.title || "Untitled"}
                </Link>
                <time
                  dateTime={s.created_at}
                  className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block"
                >
                  {formatWhen(s.created_at)}
                </time>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]",
                    meta.className,
                  )}
                >
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {songs.length > 4 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground hover:text-primary"
          aria-expanded={open}
        >
          {open ? "Show less" : `Show all ${songs.length}`}
          <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
