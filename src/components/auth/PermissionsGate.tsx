import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, MapPin, Bell, HardDrive, Loader2, Check, Settings2 } from "lucide-react";
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center text-xl">Quick setup — 3 permissions</DialogTitle>
          <DialogDescription className="text-center">
            One tap turns on every feature. Nothing is shared without your say-so, and you can
            flip any of these off in Settings anytime.
          </DialogDescription>
        </DialogHeader>

        {/* At-a-glance summary chip */}
        <div className="mx-auto inline-flex items-center gap-1.5 self-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <Check className="h-3 w-3" /> Private by default · Revoke anytime
        </div>

        <ul className="my-3 space-y-2 text-sm">
          <PermRow
            icon={<MapPin className="h-4 w-4 text-primary" />}
            title="Location"
            blurb="Local drops & smarter recs. Off until you allow it."
          />
          <PermRow
            icon={<Bell className="h-4 w-4 text-primary" />}
            title="Notifications"
            blurb="Pings when your song is ready or coins arrive."
          />
          <PermRow
            icon={<HardDrive className="h-4 w-4 text-primary" />}
            title="Offline storage"
            blurb="Keeps your library fast and available offline."
          />
        </ul>

        <p className="text-center text-[11px] text-muted-foreground">
          Change any of these later in{" "}
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
          >
            <Settings2 className="h-3 w-3" /> Settings → Privacy
          </Link>
          .
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={grantAll} disabled={busy} className="w-full">
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Allow all 3
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
