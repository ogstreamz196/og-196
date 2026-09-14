import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reconcileTrackUnlock } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

/**
 * Card unlock returns here: the checkout redirect lands back on the page the
 * user started from with `?track_unlock=1&session_id=cs_…`. We confirm the
 * payment server-side, flip the track to unlocked, then clean the URL and
 * refresh the library so the full track plays straight away.
 */
export function TrackUnlockReturnHandler() {
  const queryClient = useQueryClient();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("track_unlock") !== "1") return;
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    handled.current = true;

    const clean = () => {
      params.delete("track_unlock");
      params.delete("session_id");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
      );
    };

    void (async () => {
      const toastId = toast.loading("Confirming your payment…");
      try {
        const result = await reconcileTrackUnlock({
          data: { sessionId, environment: getStripeEnvironment() },
        });
        if ("error" in result) throw new Error(result.error);
        if (result.status === "pending") {
          toast.info("Payment is still processing — your track unlocks shortly.", { id: toastId });
        } else {
          toast.success("Paid — full track unlocked.", { id: toastId });
        }
        await queryClient.invalidateQueries({
          predicate: (q) => {
            const key = String(q.queryKey[0] ?? "");
            return key.includes("song") || key.includes("library") || key.includes("unlock");
          },
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't confirm the payment", { id: toastId });
      } finally {
        clean();
      }
    })();
  }, [queryClient]);

  return null;
}
