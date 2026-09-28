import { useEffect } from "react";
import { recordSignIn } from "@/lib/sign-in-tracking.functions";

/**
 * Mounted inside the authenticated layout. On first authenticated render
 * per browser-session, records only the account link and timestamp needed
 * for a non-sensitive boss notification.
 */
export function SignInTracker({ userId }: { userId: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `og:signin:recorded:${userId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    void recordSignIn({ data: {} }).catch(() => {});
  }, [userId]);

  return null;
}
