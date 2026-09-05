import type { Song } from "@/components/SongCard";

export type WorkspaceSong = Song & {
  user_id?: string | null;
  lyrics?: string | null;
  unlocked?: boolean | null;
  /** Stable timestamp for when the current generation began — used to resume the generating timer after a refresh. */
  generation_started_at?: string | null;
  /** Bumped whenever the row changes; fallback only when older rows do not have generation_started_at. */
  updated_at?: string | null;
  /** Provider task ID — present only after the external generator accepts the job. */
  suno_task_id?: string | null;
  /** Suno stream URL surfaced by the "first"/"text" callback — playable while the full sample is still rendering. */
  stream_audio_url?: string | null;
  /** Selected artist voice, e.g. "Female vocal". */
  vocal?: string | null;
  /** Vocals-only mode (no generated instrumental). */
  vocals_only?: boolean | null;
  /** Uploaded beat the vocals ride on. */
  beat_path?: string | null;
  /** Requested track length in seconds. */
  target_duration_sec?: number | null;
};

export type Variation = {
  id: string;
  title: string | null;
  cover_url: string | null;
  revealed: boolean;
};
