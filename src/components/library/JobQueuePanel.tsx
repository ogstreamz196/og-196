import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, Clock3, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { invokeError } from "@/lib/invoke-error";
import type { Song } from "@/components/SongCard";

type JobStatus = "queued" | "generating" | "completed" | "failed";

function classify(status: string): JobStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "processing") return "generating";
  return "queued"; // draft / pending / queued
}

const META: Record<JobStatus, { label: string; icon: typeof Clock3; cls: string; dot: string }> = {
  queued:     { label: "Queued",     icon: Clock3,        cls: "border-amber-400/40 bg-amber-400/10 text-amber-200",  dot: "bg-amber-400" },
  generating: { label: "Generating", icon: Loader2,       cls: "border-primary/40 bg-primary/10 text-primary",        dot: "bg-primary animate-pulse" },
  completed:  { label: "Completed",  icon: CheckCircle2,  cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200", dot: "bg-emerald-400" },
  failed:     { label: "Failed",     icon: AlertTriangle, cls: "border-rose-500/40 bg-rose-500/10 text-rose-200",     dot: "bg-rose-500" },
};

export function JobQueuePanel({ songs }: { songs: Song[] }) {
  const [retrying, setRetrying] = useState<string | null>(null);

  const jobs = useMemo(() => {
    return songs
      .map((s) => ({ song: s, kind: classify(s.status) }))
      .filter((j) => j.kind !== "completed")
      .slice(0, 8);
  }, [songs]);

  const counts = useMemo(() => {
    const c: Record<JobStatus, number> = { queued: 0, generating: 0, completed: 0, failed: 0 };
    for (const s of songs) c[classify(s.status)]++;
    return c;
  }, [songs]);

  async function retry(song: Song) {
    setRetrying(song.id);
    try {
      const { error } = await supabase.functions.invoke("suno-generate", {
        body: {
          song_id: song.id,
          prompt: song.prompt ?? song.title ?? "Untitled",
          lyrics: (song as { lyrics?: string }).lyrics ?? "",
          title: song.title ?? null,
          style: (song as { style?: string }).style ?? null,
        },
      });
      if (error) throw new Error(invokeError(error, "Retry failed"));
      toast.success("Retry queued");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetrying(null);
    }
  }

  if (jobs.length === 0 && counts.failed === 0) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-card/40 p-5 ring-1 ring-white/5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-fuchsia-500/15">
            <ListChecks className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-black tracking-tight sm:text-xl">Generation queue</h3>
            <p className="text-xs text-muted-foreground">Live status of your in-flight tracks</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold uppercase tracking-wider">
          {(["queued", "generating", "failed"] as JobStatus[]).map((k) => (
            <span key={k} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1", META[k].cls)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", META[k].dot)} />
              {counts[k]} {META[k].label}
            </span>
          ))}
        </div>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active jobs. Recent failures are listed above.</p>
      ) : (
        <ul className="grid gap-2">
          {jobs.map(({ song, kind }) => {
            const m = META[kind];
            const Icon = m.icon;
            return (
              <li
                key={song.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/40 p-3"
              >
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl border", m.cls)}>
                  <Icon className={cn("h-4 w-4", kind === "generating" && "animate-spin")} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/library/$songId"
                    params={{ songId: song.id }}
                    className="block truncate text-sm font-bold hover:underline"
                  >
                    {song.title || "Untitled"}
                  </Link>
                  <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                    {m.label}
                    {kind === "failed" && (song as { error_message?: string }).error_message
                      ? ` · ${(song as { error_message?: string }).error_message}`
                      : ""}
                  </p>
                </div>
                {kind === "failed" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => retry(song)}
                    disabled={retrying === song.id}
                    className="shrink-0"
                  >
                    {retrying === song.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Retry
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
