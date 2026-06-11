import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Library as LibraryIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SongCard, type Song } from "@/components/SongCard";
import { EditableContent } from "@/components/admin/EditableContent";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/library/")({
  component: LibraryPage,
});

function LibraryPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("songs").delete().eq("id", pendingDelete.id);
      if (error) throw error;
      toast.success("Track deleted");
      setPendingDelete(null);
      query.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

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
              <div key={s.id} className="relative">
                <Link
                  to="/library/$songId"
                  params={{ songId: s.id }}
                  className="block rounded-2xl transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SongCard song={s} />
                </Link>
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute right-3 top-3 h-8 w-8 opacity-90"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPendingDelete(s);
                    }}
                    aria-label="Delete track"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
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

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this track?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title || "Untitled"}" will be removed from the library. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
