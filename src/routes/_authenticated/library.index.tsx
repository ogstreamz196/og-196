import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2, Library as LibraryIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SongCard, type Song } from "@/components/SongCard";
import { EditableContent } from "@/components/admin/EditableContent";

export const Route = createFileRoute("/_authenticated/library/")({
  component: LibraryPage,
});

function LibraryPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["library", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Song[]> => {
      const { data, error } = await supabase.from("songs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Song[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("songs-library")
      .on("postgres_changes", { event: "*", schema: "public", table: "songs", filter: `user_id=eq.${user.id}` },
        () => query.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <DashboardShell title="My Library">
      <div className="mx-auto max-w-4xl">
        {query.isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : query.data && query.data.length > 0 ? (
          <div className="grid gap-3">
            {query.data.map((s) => (
              <Link
                key={s.id}
                to="/library/$songId"
                params={{ songId: s.id }}
                className="block rounded-2xl transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SongCard song={s} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
            <LibraryIcon className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">
              <EditableContent
                contentKey="library.empty"
                defaultValue="Your library is empty. Head to Home and generate your first track."
                multiline
              />
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
