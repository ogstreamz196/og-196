/** Hands a "play the full track now" request to the library page after an unlock. */
const KEY = "og:autoplay-full";

export function requestFullTrackPlay(songId: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ songId, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function peekFullTrackPlay(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { songId: string; at: number };
    if (Date.now() - v.at > 60_000) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return v.songId;
  } catch {
    return null;
  }
}

export function clearFullTrackPlay() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
