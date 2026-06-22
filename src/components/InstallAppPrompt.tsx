import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ogLogo from "@/assets/og-logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "og:install-dismissed-at";
const DISMISS_DAYS = 7;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function wasDismissedRecently(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const ts = Number(v);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || wasDismissedRecently()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari never fires beforeinstallprompt — surface manual instructions.
    if (isIOS()) {
      const t = window.setTimeout(() => setOpen(true), 4000);
      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        window.clearTimeout(t);
      };
    }

    const installedHandler = () => setOpen(false);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setOpen(false);
    setIosHelp(false);
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setOpen(false);
      } else {
        dismiss();
      }
      setDeferred(null);
      return;
    }
    // No native prompt → iOS instructions
    setIosHelp(true);
  }

  if (!open) return null;

  const ios = isIOS();

  // iOS expanded helper — still compact, anchored bottom, points to Share in Safari toolbar.
  if (iosHelp) {
    return (
      <div
        role="dialog"
        aria-label="Add OG to your Home Screen"
        className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xs animate-fade-in sm:left-auto sm:right-4 sm:mx-0"
      >
        <div className="glass-panel-strong relative overflow-hidden rounded-2xl border border-primary/40 p-3 pr-8 text-xs shadow-glow">
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="font-semibold text-foreground">Do this first 👇</div>
          <ol className="mt-1.5 space-y-1 text-muted-foreground">
            <li>1. Tap <Share className="mx-0.5 inline h-3 w-3 text-primary" /> <span className="text-foreground">Share</span> below</li>
            <li>2. Pick <Plus className="mx-0.5 inline h-3 w-3 text-primary" /> <span className="text-foreground">Add to Home Screen</span></li>
          </ol>
          <ArrowAnchor />
        </div>
      </div>
    );
  }

  // Default tiny pill — bottom-center, points down to device toolbar.
  return (
    <div
      role="dialog"
      aria-label="Install OG app"
      className="fixed inset-x-0 bottom-3 z-[60] mx-auto w-fit max-w-[92vw] animate-fade-in"
    >
      <div className="glass-panel-strong relative flex items-center gap-2 rounded-full border border-primary/40 py-1.5 pl-3 pr-1.5 text-xs shadow-glow">
        <span className="font-semibold text-foreground">Do this first 👇</span>
        <button
          onClick={install}
          className="rounded-full bg-gradient-brand px-3 py-1 text-xs font-semibold text-primary-foreground shadow-card transition hover:brightness-110"
        >
          {ios ? "Install" : "Add app"}
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <ArrowAnchor />
      </div>
    </div>
  );
}

// Downward-pointing arrow that visually anchors the pill to the device's bottom toolbar.
function ArrowAnchor() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 text-primary"
    >
      <svg width="14" height="8" viewBox="0 0 14 8" fill="currentColor">
        <path d="M7 8L0 0h14L7 8z" />
      </svg>
    </span>
  );
}

