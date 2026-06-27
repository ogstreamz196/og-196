import { Link } from "@tanstack/react-router";
import { Headphones, Music2, Zap, ArrowRight } from "lucide-react";
import type { RecentSong } from "@/hooks/use-recent-songs";

interface RecentCreationsProps {
  songs: RecentSong[];
}

export function RecentCreations({ songs }: RecentCreationsProps) {
  if (songs.length === 0) return null;

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand-soft">
            <Headphones className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Recent creations</h2>
            <p className="text-sm text-muted-foreground">Your latest tracks from across the hub.</p>
          </div>
        </div>
        <Link to="/library" className="text-sm font-medium text-primary hover:underline">
          View all →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {songs.map((song) => (
          <RecentSongCard key={song.id} song={song} />
        ))}
      </div>
    </section>
  );
}

function RecentSongCard({ song }: { song: RecentSong }) {
  return (
    <Link
      to="/library/$songId"
      params={{ songId: song.id }}
      className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30"
    >
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-brand-soft">
        {song.cover_url ? (
          <img src={song.cover_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <Music2 className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold">{song.title?.trim() || "Untitled"}</h3>
        <p className="truncate text-xs text-muted-foreground">{song.prompt.slice(0, 60)}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Zap className="h-3 w-3" /> {song.status}
          </span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
