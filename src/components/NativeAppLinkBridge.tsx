import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      .then(async ({ App }) => {
        const open = async (url: string) => {
          try {
            const u = new URL(url);
            if (u.protocol !== "https:" || !["ogbot.co.uk", "www.ogbot.co.uk"].includes(u.hostname) || u.pathname !== "/app-return") return;
            const next = u.searchParams.get("next");
            const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
            const accessToken = u.searchParams.get("access_token");
            const refreshToken = u.searchParams.get("refresh_token");
            if (accessToken && refreshToken) {
              const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
              if (error) throw error;
              window.location.replace(destination);
              return;
            }
            // The identity provider may deliver its tokens in the URL fragment.
            window.location.replace(window.location.origin + u.pathname + u.search + u.hash);
          } catch {
            window.location.replace("/welcome");
          }
        };
        const listener = await App.addListener("appUrlOpen", ({ url }) => { void open(url); });
        // Cold launches do not always fire appUrlOpen after React mounts.
        const launch = await App.getLaunchUrl();
        if (launch?.url) void open(launch.url);
        return listener;
      })
      .then((h) => {
        remove = () => void h.remove();
      })
      .catch(() => {});
    return () => remove?.();
  }, []);
  return null;
}
