// Stable per-device identifier used to enforce the 2-accounts-per-device
// limit. Best-effort (localStorage-based) anti-abuse, backed by a
// server-side check in the bootstrap so clearing storage still blocks
// repeated free-coin farming on the same browser profile.
const KEY = "og:device-id";

export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
