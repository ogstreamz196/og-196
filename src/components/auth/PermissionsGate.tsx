import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { shouldShowPermissionsGate } from "@/lib/permissions-gate-logic";
import { toast } from "sonner";

/**
 * One-time post-signin prompt that batch-requests every browser permission
 * the app may want now or later (geolocation, notifications, persistent
 * storage). Persists `profiles.gps_consent` based on the user's choice.
 *
 * Skip key is per-user so a re-grant works after they reset their profile.
 */
export function PermissionsGate({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const storageKey = `og:perms:asked:${userId}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(storageKey)) return;

    let cancelled = false;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let signInCount: number | null = null;
    let gpsConsentAt: string | null | undefined = undefined;

    const evaluate = () => {
      if (cancelled) return;
      const show = shouldShowPermissionsGate({
        localMarker: localStorage.getItem(storageKey),
        signInEventCount: signInCount,
        gpsConsentAt,
        elapsedMs: Date.now() - startedAt,
      });
      if (!show) {
        if (openTimer) clearTimeout(openTimer);
        setOpen(false);
        // Persist suppression so we don't re-evaluate next mount.
        if ((signInCount ?? 0) > 1 || gpsConsentAt) {
          localStorage.setItem(storageKey, "skipped-existing");
        }
        return;
      }
      if (!openTimer) {
        openTimer = setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, 600);
      }
    };

    const fetchOnce = async () => {
      try {
        const [eventsRes, profileRes] = await Promise.all([
          supabase
            .from("sign_in_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId),
          supabase
            .from("profiles")
            .select("gps_consent_at")
            .eq("id", userId)
            .maybeSingle(),
        ]);
        if (eventsRes.error) {
          console.warn("[PermissionsGate] sign_in_events lookup failed", eventsRes.error);
        }
        if (profileRes.error) {
          console.warn("[PermissionsGate] profiles lookup failed", profileRes.error);
        }
        signInCount = eventsRes.count ?? signInCount;
        gpsConsentAt = profileRes.data ? profileRes.data.gps_consent_at ?? null : gpsConsentAt;
      } catch (e) {
        // Network / RLS / offline: stay on fallback path so the gate still
        // hides via the stuck-gate timer instead of blocking the user.
        console.warn("[PermissionsGate] poll failed, relying on fallback window", e);
      }
      evaluate();
    };

    void fetchOnce();
    // Polling fallback in case Realtime is unavailable / IP write is delayed.
    const poll = setInterval(fetchOnce, 2500);
    // Fallback timer: re-evaluate after the stuck-gate window so the
    // fallback rule in shouldShowPermissionsGate can fire.
    const fallback = setTimeout(evaluate, 4200);

    // Realtime: hide immediately when the IP/consent row updates. If the
    // subscription itself errors out, log and keep polling — never block.
    const channel = supabase
      .channel(`perms-gate:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sign_in_events", filter: `user_id=eq.${userId}` },
        () => void fetchOnce(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const next = (payload.new as { gps_consent_at?: string | null } | null)?.gps_consent_at;
          if (next !== undefined) gpsConsentAt = next ?? null;
          evaluate();
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("[PermissionsGate] realtime subscription degraded:", status);
        }
      });

    return () => {
      cancelled = true;
      if (openTimer) clearTimeout(openTimer);
      clearTimeout(fallback);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [storageKey, userId]);

  const dismiss = (granted: boolean) => {
    localStorage.setItem(storageKey, granted ? "granted" : "declined");
    setOpen(false);
  };

  const grantAll = async () => {
    setBusy(true);
    let gpsGranted = false;
    try {
      if ("geolocation" in navigator) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              gpsGranted = true;
              resolve();
            },
            () => resolve(),
            { timeout: 6000, maximumAge: 60_000 },
          );
        });
      }

      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch {
          /* noop */
        }
      }

      try {
        if (navigator.storage?.persist) await navigator.storage.persist();
      } catch {
        /* noop */
      }

      await supabase
        .from("profiles")
        .update({
          gps_consent: gpsGranted,
          gps_consent_at: gpsGranted ? new Date().toISOString() : null,
        })
        .eq("id", userId);

      toast.success(
        gpsGranted
          ? "Permissions saved — you're all set."
          : "Saved. Add location later in Settings → Privacy.",
      );
      dismiss(true);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    try {
      await supabase
        .from("profiles")
        .update({ gps_consent: false, gps_consent_at: null })
        .eq("id", userId);
    } catch {
      /* noop */
    }
    setBusy(false);
    dismiss(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) dismiss(false);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" /> Enable all features?
          </DialogTitle>
          <DialogDescription className="text-sm">
            One tap for location, notifications & offline storage. Private by default — revoke
            anytime in Settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={grantAll} disabled={busy} className="w-full">
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Allow
          </Button>
          <Button variant="ghost" onClick={skip} disabled={busy} className="w-full">
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermRow({
  icon,
  title,
  blurb,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground">{blurb}</p>
      </div>
    </li>
  );
}
