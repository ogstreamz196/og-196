import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Library as LibraryIcon,
  Trash2,
  Plus,
  Sparkles,
  Heart,
  Notebook,
  MessageSquareMore,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { SongCard, type Song } from "@/components/SongCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  CreateSongDialog,
  composePromptFromDraft,
  type CreationFlow,
  type SongBriefDraft,
} from "@/components/library/CreateSongDialog";

export const Route = createFileRoute("/_authenticated/library/")({
  component: LibraryPage,
});

type Filter = "all" | "drafts" | "completed" | "failed";

const ENTRY_POINTS: { flow: CreationFlow; title: string; body: string; icon: React.ReactNode }[] = [
  { flow: "scratch",   title: "From scratch",     body: "Open brief and shape it.",       icon: <Plus className="h-4 w-4" /> },
  { flow: "memory",    title: "From a memory",    body: "Turn a moment into a song.",     icon: <Notebook className="h-4 w-4" /> },
  { flow: "tribute",   title: "Dedication",       body: "Honour someone you love.",       icon: <Heart className="h-4 w-4" /> },
  { flow: "messenger", title: "With OG",          body: "Co-write in OG Messenger.",      icon: <MessageSquareMore className="h-4 w-4" /> },
];

function LibraryPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openFlow, setOpenFlow] = useState<CreationFlow | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const query = useQuery({
    queryKey: ["library", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Song[]> => {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Song[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("songs-library")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "songs", filter: `user_id=eq.${user.id}` },
        () => query.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const songs = query.data ?? [];
  const filtered = useMemo(() => filterSongs(songs, filter), [songs, filter]);

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

  async function handleCreate(draft: SongBriefDraft) {
    if (!user) return;
    if (draft.flow === "messenger") {
      setOpenFlow(null);
      navigate({ to: "/messenger" });
      return;
    }
    const prompt = composePromptFromDraft(draft);
    const { data, error } = await supabase
      .from("songs")
      .insert({
        user_id: user.id,
        prompt,
        title: draft.title || null,
        style: [draft.mood, draft.genre, draft.lyricalStyle].filter(Boolean).join(" · ") || null,
        status: "draft",
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message || "Couldn't save draft");
      return;
    }
    toast.success("Draft saved");
    setOpenFlow(null);
    if (data?.id) navigate({ to: "/library/$songId", params: { songId: data.id } });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      {/* Heading */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Your studio
          </p>
          <h1 className="font-display mt-3 text-4xl font-light leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            Music <em className="italic text-gradient-brand">Hub</em>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Create personalised tracks and manage every song project in one place.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => setOpenFlow("scratch")}
          className="shrink-0 gap-2 bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> New song
        </Button>
      </header>

      {/* Creation entry points */}
      <section>
        <h2 className="mb-4 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Start a new song
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ENTRY_POINTS.map((e) => (
            <button
              key={e.flow}
              type="button"
              onClick={() => setOpenFlow(e.flow)}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-card/70 p-5 text-left shadow-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-gradient-brand-soft text-primary">
                {e.icon}
              </span>
              <div className="min-w-0">
                <p className="font-display text-base font-normal tracking-tight">{e.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.body}</p>
              </div>
            </button>
          ))}
        </div>
      </section>


      {/* List */}
      <section>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <div className="mb-4 flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All ({songs.length})</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="failed">Issues</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={filter} className="m-0">
            {query.isLoading ? (
              <div className="grid place-items-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid gap-3">
                {filtered.map((s) => (
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
              <EmptyState onCreate={() => setOpenFlow("scratch")} filter={filter} />
            )}
          </TabsContent>
        </Tabs>
      </section>

      <CreateSongDialog flow={openFlow} onClose={() => setOpenFlow(null)} onSubmit={handleCreate} />

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
    </div>
  );
}

function filterSongs(songs: Song[], filter: Filter): Song[] {
  if (filter === "all") return songs;
  if (filter === "completed") return songs.filter((s) => s.status === "completed");
  if (filter === "failed") return songs.filter((s) => s.status === "failed");
  return songs.filter((s) => s.status === "draft" || s.status === "pending" || s.status === "processing");
}

function EmptyState({ onCreate, filter }: { onCreate: () => void; filter: Filter }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
        <LibraryIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">
        {filter === "all" ? "No songs yet" : `Nothing in ${filter}`}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Start your first personalised song — from scratch, a memory, or a dedication.
      </p>
      <Button onClick={onCreate} className="mt-5 gap-2">
        <Sparkles className="h-4 w-4" /> Start a song
      </Button>
    </div>
  );
}
