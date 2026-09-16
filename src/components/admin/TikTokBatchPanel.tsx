import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clapperboard, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { getTikTokRenderStatus, queueTikTokBatch } from "@/lib/tiktok-batch.functions";

/**
 * Boss control for the TikTok video queue: one button marks every paid-unlocked
 * track that has no video yet as pending, so the batch renderer compiles them
 * into the "TikTok Ready" Drive folder.
 */
export function TikTokBatchPanel() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getTikTokRenderStatus);
  const runBatch = useServerFn(queueTikTokBatch);

  const status = useQuery({
    queryKey: ["tiktok-render-status"],
    queryFn: () => fetchStatus({ data: undefined }),
    staleTime: 30_000,
  });

  const queue = useMutation({
    mutationFn: () => runBatch({ data: undefined }),
    onSuccess: (res) => {
      qc.setQueryData(["tiktok-render-status"], res.status);
      toast.success(
        res.queued === 0
          ? "Nothing pending — every paid track already has a video."
          : `${res.queued} track${res.queued === 1 ? "" : "s"} queued for compiling.`,
      );
    },
    onError: () => toast.error("Could not start the batch."),
  });

  const s = status.data;

  return (
    <AdminSection
      icon={<Clapperboard className="h-5 w-5 text-primary" />}
      title="TikTok videos"
      subtitle="Compile paid-unlocked tracks over the background clip into the TikTok Ready folder."
      action={
        <Button
          onClick={() => queue.mutate()}
          disabled={queue.isPending}
          className="w-full gap-2 sm:w-auto"
        >
          {queue.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clapperboard className="h-4 w-4" />
          )}
          Run TikTok batch
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Waiting", value: s?.queued },
          { label: "Pending", value: s?.pending },
          { label: "Done", value: s?.done },
          { label: "Failed", value: s?.failed },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</div>
            <div className="font-display text-2xl font-black">
              {status.isLoading ? "—" : (stat.value ?? 0)}
            </div>
          </div>
        ))}
      </div>

      {s?.recent?.length ? (
        <ul className="mt-4 space-y-1.5 text-sm">
          {s.recent.map((r) => (
            <li
              key={r.song_id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate">{r.title ?? r.song_id.slice(0, 8)}</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {r.status}
              </span>
              {r.drive_url && (
                <a
                  href={r.drive_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Open
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => status.refetch()}
          disabled={status.isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${status.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <p className="text-xs text-muted-foreground">
          Finished videos land in the TikTok Ready folder in Drive, muted original, 3 minutes, with
          fades.
        </p>
      </div>
    </AdminSection>
  );
}
