/**
 * Pure decision logic for the post-signin PermissionsGate.
 *
 * Returns whether the "Quick setup — 3 permissions" dialog should still
 * appear. The gate is first-time only: once an IP has been registered for
 * the user (a `sign_in_events` row exists) or the profile has a recorded
 * `gps_consent_at` decision, the dialog is suppressed forever on this
 * device.
 *
 * Fallback rule: if both lookups are still loading/missing past the
 * fallback window (e.g. RLS lag, offline, slow Realtime), we treat the
 * user as "registered" so the gate cannot stay stuck open across renders.
 */
export type GateInputs = {
  /** Cached "asked" marker from localStorage (null if never set). */
  localMarker: string | null;
  /** Count of sign_in_events rows for this user (null = unknown/error). */
  signInEventCount: number | null;
  /** profiles.gps_consent_at value (null = no decision; undefined = unknown). */
  gpsConsentAt: string | null | undefined;
  /** ms elapsed since the gate started waiting for backend data. */
  elapsedMs: number;
  /** Fallback window before we assume "registered" to avoid stuck gates. */
  fallbackMs?: number;
};

export function shouldShowPermissionsGate(input: GateInputs): boolean {
  const { localMarker, signInEventCount, gpsConsentAt, elapsedMs } = input;
  const fallbackMs = input.fallbackMs ?? 4000;

  // User already answered on this device.
  if (localMarker) return false;

  // Backend says: IP registered (>1 sign-in events) or consent recorded.
  if ((signInEventCount ?? 0) > 1) return false;
  if (gpsConsentAt) return false;

  // Fallback: if we still don't have a definitive answer after the window,
  // suppress the dialog so it cannot get stuck waiting on missing data.
  const lookupsUnknown = signInEventCount === null && gpsConsentAt === undefined;
  if (lookupsUnknown && elapsedMs >= fallbackMs) return false;

  return true;
}
