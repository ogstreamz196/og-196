import type { Song } from "@/components/SongCard";

export type WorkspaceSong = Song & {
  lyrics?: string | null;
  unlocked?: boolean | null;
  /** Bumped whenever the row changes, including the moment status flips to pending — used to resume the generating timer after a refresh. */
  updated_at?: string | null;
};

export type Variation = {
  id: string;
  title: string | null;
  cover_url: string | null;
  revealed: boolean;
};
