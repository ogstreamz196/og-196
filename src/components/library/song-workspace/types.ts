import type { Song } from "@/components/SongCard";

export type WorkspaceSong = Song & { lyrics?: string | null; unlocked?: boolean | null };

export type Variation = {
  id: string;
  title: string | null;
  cover_url: string | null;
  revealed: boolean;
};
