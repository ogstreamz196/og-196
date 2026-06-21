import { useAuth } from "./use-auth";

// Single source of truth for the dev account. Mirrors handle_new_user() in SQL.
export const DEV_EMAIL = "ogstreamz196@gmail.com";

/**
 * Returns whether the current signed-in user is the dev / project owner.
 * Used across the UI to hide the real email / display name and replace it
 * with a generic "Developer" / "Dev mode" badge.
 */
export function useDevMode() {
  const { user } = useAuth();
  const isDev = !!user?.email && user.email.toLowerCase() === DEV_EMAIL;
  return {
    isDev,
    // Drop-in replacements
    displayName: isDev ? "Developer" : null,
    shortLabel: isDev ? "Dev mode" : null,
    avatarInitial: isDev ? "D" : null,
  };
}
