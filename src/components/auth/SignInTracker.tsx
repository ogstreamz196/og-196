import { useEffect } from "react";
import { recordSignIn } from "@/lib/sign-in-tracking.functions";

/**
 * Mounted inside the authenticated layout. On first authenticated render
 * per browser-session, posts referrer/landing path to the server which
 * captures IP/geo/UA + queues boss notifications. GPS is opt-in (settings).
 */
export function SignInTracker({ userId, gpsConsent }: { userId: string; gpsConsent: boolean }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `og:signin:recorded:${userId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const send = (gpsLat: number | null, gpsLng: number | null) => {
      void recordSignIn({
        data: {
          referrer: document.referrer || null,
          landingPath: window.location.pathname + window.location.search,
          gpsLat,
          gpsLng,
        },
      }).catch(() => {});
    };

    if (gpsConsent && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => send(pos.coords.latitude, pos.coords.longitude),
        () => send(null, null),
        { timeout: 4000, maximumAge: 60_000 },
      );
    } else {
      send(null, null);
    }
  }, [userId, gpsConsent]);

  return null;
}
