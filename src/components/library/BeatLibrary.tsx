import { useEffect, useRef, useState } from "react";
import { Disc3, Loader2, Pause, Play, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type SavedBeat = { path: string; name: string; size: number };

const MAX_BYTES = 20 * 1024 * 1024;

function pretty(name: string) {
  // Uploads are stored as `<timestamp>-<original name>`; show the readable part.
  const stripped = name.replace(/^\d{10,}-/, "");
  const base = stripped.replace(/\.[a-z0-9]+$/i, "") || stripped;
  // Wizard uploads land as bare UUIDs — give those a friendly short label.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)) {
    return `Beat ${base.slice(0, 8).toUpperCase()}`;
  }
  return base;
}


/**
 * Beat library — the user's own uploaded instrumentals, saved in the private
 * `beats` bucket. Beats can be previewed, deleted, and remixed: "New vocals"
 * opens the create wizard pre-armed with vocals-only mode over that beat.
 */
export function BeatLibrary({
  userId,
  onRemix,
}: {
  userId: string | undefined;
  onRemix: (beat: SavedBeat) => void;
}) {
  const [beats, setBeats] = useState<SavedBeat[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("beats")
        .list(userId, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      setBeats(
        (data ?? [])
          .filter((f) => !f.name.startsWith("."))
          .map((f) => ({
            path: `${userId}/${f.name}`,
            name: pretty(f.name),
            size: (f.metadata as { size?: number } | null)?.size ?? 0,
          })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load your beats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  async function upload(file: File) {
    if (!userId) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Please choose an audio file (MP3, WAV, M4A…)");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Beat must be under 20MB");
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-60);
      const path = `${userId}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("beats")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      toast.success("Beat saved to your library");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function togglePlay(beat: SavedBeat) {
    const el = (audioRef.current ??= new Audio());
    if (playing === beat.path) {
      el.pause();
      setPlaying(null);
      return;
    }
    setBusyPath(beat.path);
    try {
      const { data, error } = await supabase.storage
        .from("beats")
        .createSignedUrl(beat.path, 600);
      if (error || !data?.signedUrl) throw error ?? new Error("Couldn't open that beat");
      el.src = data.signedUrl;
      el.onended = () => setPlaying(null);
      await el.play();
      setPlaying(beat.path);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Playback failed");
    } finally {
      setBusyPath(null);
    }
  }

  async function remove(beat: SavedBeat) {
    setBusyPath(beat.path);
    try {
      const { error } = await supabase.storage.from("beats").remove([beat.path]);
      if (error) throw error;
      if (playing === beat.path) {
        audioRef.current?.pause();
        setPlaying(null);
      }
      setBeats((b) => b.filter((x) => x.path !== beat.path));
      toast.success("Beat deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyPath(null);
    }
  }

  return (
    <section className="studio-panel px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Disc3 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-xl font-black tracking-tight sm:text-2xl">
              Beat library
            </h2>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Save beats · remix vocals over them anytime
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={uploading || !userId}
          onClick={() => fileRef.current?.click()}
          className="gap-1.5 font-black uppercase tracking-wide"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add beat
        </Button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading your beats…</p>
        ) : beats.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-muted-foreground">
            No beats saved yet. Upload an instrumental and the studio will sing your vocals right
            over it.
          </p>
        ) : (
          <ul className="grid w-full gap-1.5">
            {beats.map((b) => (
              <li
                key={b.path}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-2xl border border-white/10 bg-background/40 px-3 py-2.5",
                  playing === b.path && "border-primary/40 bg-primary/5",
                )}
              >
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={playing === b.path ? `Pause ${b.name}` : `Play ${b.name}`}
                  disabled={busyPath === b.path}
                  onClick={() => void togglePlay(b)}
                  className="h-9 w-9 shrink-0 rounded-full border border-primary/30 text-primary"
                >
                  {busyPath === b.path ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : playing === b.path ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <p className="min-w-0 flex-1 truncate text-sm font-bold" title={b.name}>
                  {b.name}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onRemix(b)}
                  aria-label={`New vocals over ${b.name}`}
                  className="h-8 shrink-0 gap-1.5 bg-gradient-brand px-2.5 text-[11px] font-black uppercase tracking-wide text-primary-foreground sm:px-3"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">New vocals</span>
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${b.name}`}
                  disabled={busyPath === b.path}
                  onClick={() => void remove(b)}
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>

        )}
      </div>
    </section>
  );
}
