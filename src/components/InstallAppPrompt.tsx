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

  // iOS step-by-step modal — full-screen overlay with clear "Add to Home Screen" callout.
  if (iosHelp) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add OG to your Home Screen"
        className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm animate-fade-in sm:items-center"
        onClick={dismiss}
      >
        <div
          className="glass-panel-strong relative w-full max-w-sm overflow-hidden rounded-3xl border border-border/60 p-6 shadow-glow"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={dismiss}
            aria-label="Close"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center text-center">
            <img
              src={ogLogo}
              alt=""
              className="h-16 w-16 rounded-2xl border border-border/60 object-cover shadow-card"
            />
            <h2 className="mt-4 font-display text-2xl leading-tight">Install OG on your iPhone</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Three taps in Safari and you're done.
            </p>
          </div>

          <ol className="mt-5 space-y-3">
            <li className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
              <div className="min-w-0 flex-1 text-sm">
                Tap the <Share className="mx-1 inline h-4 w-4 text-primary" aria-label="Share" />
                <span className="font-semibold">Share</span> button at the bottom of Safari.
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border-2 border-primary/60 bg-primary/10 p-3 shadow-glow">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
              <div className="min-w-0 flex-1 text-sm">
                Scroll and choose <Plus className="mx-1 inline h-4 w-4 text-primary" aria-label="Add" />
                <span className="font-bold text-foreground">Add to Home Screen</span>.
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">3</span>
              <div className="min-w-0 flex-1 text-sm">
                Tap <span className="font-semibold">Add</span> in the top-right — OG opens like a real app.
              </div>
            </li>
          </ol>

          <Button onClick={dismiss} className="mt-5 w-full bg-gradient-brand text-primary-foreground shadow-glow">
            Got it
          </Button>
        </div>
      </div>
    );
  }

  // Default install banner (Android/Chromium fires beforeinstallprompt; iOS taps Install → opens modal above).
  return (
    <div
      role="dialog"
      aria-label="Install OG app"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md animate-fade-in sm:left-auto sm:right-4 sm:mx-0"
    >
      <div className="glass-panel-strong relative overflow-hidden rounded-2xl border border-border/60 p-4 shadow-glow">
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <img
            src={ogLogo}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl border border-border/60 object-cover shadow-card"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-tight">Install OG on your phone</div>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              One tap to add it to your home screen — opens like a real app, no browser bars.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={install} className="h-8 gap-1.5 px-3 text-xs">
                <Download className="h-3.5 w-3.5" />
                {isIOS() ? "Show me how" : "Install app"}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} className="h-8 px-2 text-xs">
                Not now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

