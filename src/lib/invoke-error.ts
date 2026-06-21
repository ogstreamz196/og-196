/** Extract a human-readable message from a Supabase functions.invoke() failure. */
export function invokeError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === "object") {
    const e = err as { context?: { error?: string }; message?: string };
    return e.context?.error || e.message || fallback;
  }
  return fallback;
}
