import { useEffect, useState } from "react";
import { Lock, Swords, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MessengerMode } from "@/hooks/use-messenger-mode";
import { modeHeading } from "@/lib/messenger-mode-labels";
import ogBotAsset from "@/assets/ogbot.png.asset.json";

export function greetKey(uid: string | null | undefined) {
  return `og:messenger-greeting:${uid ?? "anon"}`;
}

/**
 * Decide whether the polite greeting should be shown for this user.
 * Asked once per browser session — there is no "remember my choice" option.
 */
export function shouldGreet(uid: string | null | undefined): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(greetKey(uid)) === "asked") return false;
  } catch {
    return false;
  }
  return true;
}

export function markGreeted(uid: string | null | undefined) {
  try {
    window.sessionStorage.setItem(greetKey(uid), "asked");
  } catch {
    /* storage unavailable — greeting simply shows again */
  }
}

type Props = {
  open: boolean;
  displayName?: string | null;
  currentMode: MessengerMode;
  pending?: boolean;
  onChoose: (mode: MessengerMode) => void;
  onDismiss: () => void;
};

export function MessengerWelcomeDialog({
  open,
  displayName,
  currentMode,
  pending,
  onChoose,
  onDismiss,
}: Props) {
  const [picked, setPicked] = useState<MessengerMode | null>(null);

  useEffect(() => {
    if (open) setPicked(null);
  }, [open]);

  const name = (displayName ?? "").trim().split(/\s+/)[0] || "friend";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent
        className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto p-5 sm:p-6"
      >
        <DialogHeader className="items-center !text-center">
          <img
            src={ogBotAsset.url}
            alt="OG Bot"
            className="mb-1 h-14 w-14 rounded-full object-cover ring-2 ring-primary/50 ring-offset-2 ring-offset-card"
          />
          <DialogTitle className="text-balance text-xl font-black leading-tight sm:text-2xl">
            Hey {name} — lovely to see you.
          </DialogTitle>
          <DialogDescription className="text-pretty text-sm leading-relaxed">
            Would you kindly choose where you&apos;d like to chat today? You can change your mind
            any time with the button up top.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setPicked("loner");
              onChoose("loner");
            }}
            className="group flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-3.5 text-left transition-all hover:bg-primary/20 active:scale-[0.99] disabled:opacity-60 sm:p-4"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/20 ring-1 ring-primary/50">
              {pending && picked === "loner" ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Lock className="h-5 w-5 text-primary" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black uppercase tracking-wide sm:text-base">
                Private chat
              </span>
              <span className="block text-pretty text-xs text-muted-foreground sm:text-sm">
                Just you &amp; OG Bot. Nobody else sees a word.
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setPicked("community");
              onChoose("community");
            }}
            className="group flex w-full items-center gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-3.5 text-left transition-all hover:bg-destructive/20 active:scale-[0.99] disabled:opacity-60 sm:p-4"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-destructive/20 ring-1 ring-destructive/50">
              {pending && picked === "community" ? (
                <Loader2 className="h-5 w-5 animate-spin text-destructive" />
              ) : (
                <Swords className="h-5 w-5 text-destructive" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black uppercase tracking-wide sm:text-base">
                OG Battle Zone
              </span>
              <span className="block text-pretty text-xs text-muted-foreground sm:text-sm">
                Everyone vs OG Bot. Think you can take him in a roast battle?
              </span>
            </span>
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/80">
          You&apos;re currently set to{" "}
          <span className="font-semibold text-foreground">{modeHeading(currentMode)}</span>.
        </p>
      </DialogContent>
    </Dialog>
  );
}
