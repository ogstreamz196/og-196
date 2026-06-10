// Pure utility describing the lifecycle of an in-flight Suno generation.
// Kept side-effect free so it can be unit-tested without React/Supabase.

export type WatchState = "idle" | "watching" | "completed" | "failed" | "timeout";

export interface WatchSong {
  suno_task_id: string | null;
  status: string;
  error_message?: string | null;
}

export interface WatchInput {
  taskId: string | null;
  startedAt: number | null;
  now: number;
  songs: WatchSong[];
  timeoutMs?: number;
  expectedCount?: number;
}

export interface WatchResult {
  state: WatchState;
  matched: WatchSong[];
  elapsedMs: number;
  errorMessage?: string;
}

export const DEFAULT_TIMEOUT_MS = 180_000; // 3 minutes — Suno usually completes in 30–120s.

export function computeWatch(input: WatchInput): WatchResult {
  const {
    taskId,
    startedAt,
    now,
    songs,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    expectedCount = 1,
  } = input;

  if (!taskId || !startedAt) {
    return { state: "idle", matched: [], elapsedMs: 0 };
  }

  const matched = songs.filter((s) => s.suno_task_id === taskId);
  const elapsedMs = Math.max(0, now - startedAt);

  const failed = matched.find((s) => s.status === "failed");
  if (failed) {
    return {
      state: "failed",
      matched,
      elapsedMs,
      errorMessage: failed.error_message ?? "Generation failed",
    };
  }

  const completed = matched.filter((s) => s.status === "completed");
  if (completed.length >= expectedCount && completed.length === matched.length) {
    return { state: "completed", matched, elapsedMs };
  }

  if (elapsedMs > timeoutMs) {
    return {
      state: "timeout",
      matched,
      elapsedMs,
      errorMessage: "Generation took too long — try again.",
    };
  }

  return { state: "watching", matched, elapsedMs };
}
