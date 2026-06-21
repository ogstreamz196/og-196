import { useAuth } from "./use-auth";
import { DEV_DISPLAY_NAME, DEV_EMAIL, isDevEmail } from "@/lib/dev-identity";

export { DEV_EMAIL };

/**
 * Returns whether the current signed-in user is the dev / project owner.
 * Used across the UI to hide the real email / display name and replace it
 * with a generic "Developer" / "Dev mode" badge.
 */
export function useDevMode() {
  const { user } = useAuth();
  const isDev = isDevEmail(user?.email);
  return {
    isDev,
    // Drop-in replacements
    displayName: isDev ? DEV_DISPLAY_NAME : null,
    shortLabel: isDev ? "Dev mode" : null,
    avatarInitial: isDev ? "D" : null,
  };
}
