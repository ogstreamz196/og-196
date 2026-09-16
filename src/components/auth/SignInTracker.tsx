import { useEffect } from "react";
import { recordSignIn } from "@/lib/sign-in-tracking.functions";

/**
 * Mounted inside the authenticated layout. On first authenticated render
 * per browser-session, posts referrer/landing path to the server which
 * captures IP/geo/UA + queues boss notifications.
 *
 * No browser location prompt is ever triggered here.
 */
export function SignInTracker({ userId }: { userId: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `og:signin:recorded:${userId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    void recordSignIn({
      data: {
        referrer: document.referrer || null,
        landingPath: window.location.pathname + window.location.search,
        gpsLat: null,
        gpsLng: null,
      },
    }).catch(() => {});
  }, [userId]);

  return null;
}
