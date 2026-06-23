// Single source of truth for masking the dev/owner identity in the UI and
// in backend payloads. The raw email "ogstreamz196@gmail.com" must never
// leak — everywhere it appears (lists, chat context, profile hooks) it is
// replaced with a generic "Developer" handle.

export const DEV_EMAIL = "ogstreamz196@gmail.com";
export const DEV_DISPLAY_NAME = "Developer";
export const DEV_EMAIL_MASK = "developer@local";

export function isDevEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === DEV_EMAIL;
}

export type MaskableProfile = {
  email?: string | null;
  display_name?: string | null;
};

/**
 * Return a copy of the profile-like object with the dev's identity masked.
 * Safe to pass null/undefined.
 */
export function maskDevIdentity<T extends MaskableProfile>(profile: T): T;
export function maskDevIdentity<T extends MaskableProfile>(profile: T | null): T | null;
export function maskDevIdentity<T extends MaskableProfile>(
  profile: T | null | undefined,
): T | null | undefined;
export function maskDevIdentity<T extends MaskableProfile>(
  profile: T | null | undefined,
): T | null | undefined {
  if (!profile) return profile;
  if (!isDevEmail(profile.email)) return profile;
  const current = (profile.display_name ?? "").trim();
  // Preserve any custom display name the dev has set for themselves; only
  // fall back to the generic "Developer" label when nothing meaningful is set.
  const hasCustomName =
    current.length > 0 &&
    current.toLowerCase() !== DEV_EMAIL.toLowerCase() &&
    current.toLowerCase() !== DEV_EMAIL_MASK.toLowerCase();
  return {
    ...profile,
    email: DEV_EMAIL_MASK,
    display_name: hasCustomName ? profile.display_name : DEV_DISPLAY_NAME,
  };
}
