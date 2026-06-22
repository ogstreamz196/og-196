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

        {!iosHelp ? (
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
                  Install app
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss} className="h-8 px-2 text-xs">
                  Not now
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="pr-6">
            <div className="text-sm font-semibold">Add OG to your Home Screen</div>
            <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">1</span>
                Tap <Share className="inline h-3.5 w-3.5" /> Share at the bottom of Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">2</span>
                Choose <Plus className="inline h-3.5 w-3.5" /> Add to Home Screen
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">3</span>
                Tap Add — OG opens like a real app
              </li>
            </ol>
            <Button size="sm" variant="ghost" onClick={dismiss} className="mt-3 h-8 px-2 text-xs">
              Got it
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
