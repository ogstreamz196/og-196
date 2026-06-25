import { useEffect, useState } from "react";
import { ShieldCheck, MapPin, Bell, HardDrive, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * One-time post-signin prompt that batch-requests every browser permission
 * the app may want now or in future (geolocation, notifications, persistent
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
    // Show shortly after mount so it doesn't fight with route transition.
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [storageKey]);

  const dismiss = (granted: boolean) => {
    localStorage.setItem(storageKey, granted ? "granted" : "declined");
    setOpen(false);
  };

  const grantAll = async () => {
    setBusy(true);
    let gpsGranted = false;
    try {
      // 1) Geolocation — triggers native prompt.
      if ("geolocation" in navigator) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => { gpsGranted = true; resolve(); },
            () => resolve(),
            { timeout: 6000, maximumAge: 60_000 },
          );
        });
      }

      // 2) Notifications — best-effort, ignore if unsupported.
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch { /* noop */ }
      }

      // 3) Persistent storage — avoids eviction of song cache.
      try {
        if (navigator.storage?.persist) await navigator.storage.persist();
      } catch { /* noop */ }

      // Persist GPS consent server-side so SignInTracker uses it on next visit.
      await supabase
        .from("profiles")
        .update({
          gps_consent: gpsGranted,
          gps_consent_at: gpsGranted ? new Date().toISOString() : null,
        })
        .eq("id", userId);

      toast.success(gpsGranted ? "All permissions granted" : "Saved. You can grant location later in Settings.");
      dismiss(true);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    try {
      await supabase.from("profiles").update({ gps_consent: false, gps_consent_at: null }).eq("id", userId);
    } catch { /* noop */ }
    setBusy(false);
    dismiss(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(false); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center">Enable all the good stuff</DialogTitle>
          <DialogDescription className="text-center">
            One tap unlocks every feature. We only use what you grant.
          </DialogDescription>
        </DialogHeader>

        <ul className="my-2 space-y-2 text-sm">
          <li className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span>Location — local drops, smarter recs</span>
          </li>
          <li className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
            <Bell className="h-4 w-4 text-primary" />
            <span>Notifications — song-ready pings, coin alerts</span>
          </li>
          <li className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
            <HardDrive className="h-4 w-4 text-primary" />
            <span>Offline storage — keep your library handy</span>
          </li>
        </ul>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={grantAll} disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Grant all
          </Button>
          <Button variant="ghost" onClick={skip} disabled={busy} className="w-full">
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
