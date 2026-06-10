import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SongCard, type Song } from "@/components/SongCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/library/$songId")({
  component: SongDetailPage,
});

function SongDetailPage() {
  const { songId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["song", songId],
    queryFn: async (): Promise<Song | null> => {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .eq("id", songId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Song | null;
    },
  });

  return (
    <DashboardShell title="Player">
      <div className="mx-auto max-w-3xl space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/library">
            <ArrowLeft className="h-4 w-4" /> Back to library
          </Link>
        </Button>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error || !data ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center text-muted-foreground">
            Track not found.
          </div>
        ) : (
          <SongCard song={data} />
        )}
      </div>
    </DashboardShell>
  );
}
