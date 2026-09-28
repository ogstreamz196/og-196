import { useEffect } from "react";

/**
 * In the Android app, when the phone browser hands an ogbot.co.uk link back
 * (e.g. after Google sign-in), load that link inside the app. No-op on the web.
 */
export function NativeAppLinkBridge() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    let remove: (() => void) | undefined;
    import("@capacitor/app")
      .then(({ App }) =>
        App.addListener("appUrlOpen", ({ url }) => {
          try {
            const u = new URL(url);
            if (u.hostname.endsWith("ogbot.co.uk")) {
              window.location.href = window.location.origin + u.pathname + u.search + u.hash;
            }
          } catch {
            /* ignore malformed links */
          }
        }),
      )
      .then((h) => {
        remove = () => void h.remove();
      })
      .catch(() => {});
    return () => remove?.();
  }, []);
  return null;
}
