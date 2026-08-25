import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { POOLS } from "@/lib/library-utils";
import { cn } from "@/lib/utils";

export type WizardResult = {
  title: string;
  subjectName: string;
  description: string;
  style: string;
  language: string;
};

/** Raw wizard inputs — kept by the parent so a retry never loses them. */
export type WizardDraft = {
  title: string;
  subjectName: string;
  description: string;
  styles: string[];
  gender: string;
  languages: string[];
};

export const EMPTY_DRAFT: WizardDraft = {
  title: "",
  subjectName: "",
  description: "",
  styles: [],
  gender: "",
  languages: [],
};

const GENDERS = ["Female vocal", "Male vocal", "Duo", "Any voice"];

const TOTAL_STEPS = 5;

/** Curated styles first, then everything else we already support. */
const STYLES: string[] = (() => {
  const featured = ["Drill", "Hip Hop", "Bass Beats", "Reggae", "Trap"];
  const rest = POOLS.genre.filter((g) => !featured.includes(g));
  return [...featured, ...rest];
})();

export function CreateNowWizard({
  open,
  onOpenChange,
  onComplete,
  initialDraft,
  submitLabel = "Create my song",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete: (result: WizardResult, draft: WizardDraft) => void;
  initialDraft?: WizardDraft;
  submitLabel?: string;
}) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [description, setDescription] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [gender, setGender] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [confirmClose, setConfirmClose] = useState(false);

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  // Reopen with whatever the user last entered so a retry keeps their work.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setConfirmClose(false);
    const d = initialDraft;
    if (!d) return;
    setTitle(d.title);
    setSubjectName(d.subjectName);
    setDescription(d.description);
    setStyles(d.styles);
    setGender(d.gender);
    setLanguages(d.languages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty =
    title.trim().length > 0 ||
    subjectName.trim().length > 0 ||
    description.trim().length > 0 ||
    styles.length > 0 ||
    languages.length > 0 ||
    gender.length > 0;

  /** Guard closing mid-step: confirm first, unless nothing was entered. */
  function requestClose() {
    if (dirty || step > 1) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(false);
  }

  function discardAndClose() {
    setConfirmClose(false);
    setTitle("");
    setSubjectName("");
    setDescription("");
    setStyles([]);
    setGender("");
    setLanguages([]);
    setStep(1);
    onOpenChange(false);
  }


  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return title.trim().length > 0;
      case 2:
        return subjectName.trim().length > 0;
      case 3:
        return description.trim().length >= 12;
      case 4:
        return styles.length > 0;
      default:
        return languages.length > 0;
    }
  }, [step, title, subjectName, description, styles, languages]);

  const hint = useMemo(() => {
    if (stepValid) return null;
    switch (step) {
      case 1:
        return "Give your track a name to continue.";
      case 2:
        return "Tell us who it's about — a person, a group, a brand, or yourself.";
      case 3:
        return "Add a few more words about the story or vibe.";
      case 4:
        return "Pick at least one style (you can stack a few).";
      default:
        return "Pick at least one language — English is always in the mix.";
    }
  }, [step, stepValid]);

  function next() {
    if (!stepValid) return;
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    onComplete(
      {
        title: title.trim(),
        subjectName: subjectName.trim(),
        description: description.trim(),
        style: [...styles, gender].filter(Boolean).join(", "),
        language: Array.from(new Set(["English", ...languages])).join(" + "),
      },
      { title, subjectName, description, styles, gender, languages },
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : requestClose())}>
      <DialogContent
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          requestClose();
        }}
        className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-2xl"
      >

        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3 w-3" />
              Create now
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Step {step} of {TOTAL_STEPS}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-valuenow={step}
            aria-label="Wizard progress"
          >
            <div
              className="h-full bg-gradient-brand transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <DialogTitle className="font-display text-2xl font-black leading-tight sm:text-3xl">
            {step === 1 && "Give your track a name"}
            {step === 2 && "Who is this track about?"}
            {step === 3 && "What will this track be about?"}
            {step === 4 && "Choose a style"}
            {step === 5 && "Select language"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {step === 1 && "This becomes the title of your track."}
            {step === 2 && "A person, a group, a brand — or yourself."}
            {step === 3 && "A short description, theme or story."}
            {step === 4 && "Stack as many styles as you like, then pick the voice."}
            {step === 5 && "English is always part of the remix — add any others."}
          </DialogDescription>
        </DialogHeader>

        <div
          key={step}
          className="min-h-[168px] animate-in fade-in slide-in-from-right-4 py-1 duration-300"
        >
          {step === 1 && (
            <>
              <Label htmlFor="wiz-title" className="sr-only">
                Track name
              </Label>
              <Input
                id="wiz-title"
                autoFocus
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()}
                placeholder="e.g. Late night drive"
                className="h-12 rounded-xl border-2 border-primary/30 bg-background/80 text-base font-bold sm:h-14 sm:text-lg"
              />
            </>
          )}

          {step === 2 && (
            <>
              <Label htmlFor="wiz-subject" className="sr-only">
                Who is this track about?
              </Label>
              <Input
                id="wiz-subject"
                autoFocus
                value={subjectName}
                maxLength={60}
                onChange={(e) => setSubjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()}
                placeholder="e.g. Aaliyah, the crew, or yourself"
                className="h-12 rounded-xl border-2 border-primary/30 bg-background/80 text-base font-bold sm:h-14 sm:text-lg"
              />
            </>
          )}

          {step === 3 && (
            <>
              <Label htmlFor="wiz-desc" className="sr-only">
                Track description
              </Label>
              <Textarea
                id="wiz-desc"
                autoFocus
                rows={6}
                value={description}
                maxLength={2000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vibes, memories, inside jokes, the moment you want in the lyrics…"
                className="min-h-[150px] resize-y rounded-xl border-primary/30 bg-background/60 text-base leading-relaxed"
              />
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                {description.trim().length}/2000
              </p>
            </>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div
                role="group"
                aria-label="Track styles"
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              >
                {STYLES.map((s) => {
                  const selected = styles.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setStyles((prev) => toggle(prev, s))}
                      className={cn(
                        "min-h-11 rounded-xl border px-3 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected
                          ? "border-primary bg-primary/20 text-foreground shadow-glow"
                          : "border-white/10 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Artist voice (optional)
                </p>
                <div role="group" aria-label="Artist voice" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {GENDERS.map((g) => {
                    const selected = gender === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setGender((prev) => (prev === g ? "" : g))}
                        className={cn(
                          "min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          selected
                            ? "border-primary bg-primary/20 text-foreground shadow-glow"
                            : "border-white/10 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-primary">
                English is always included in the remix.
              </p>
              <div
                role="group"
                aria-label="Languages"
                className="grid max-h-[240px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3"
              >
                {POOLS.language.map((l) => {
                  const locked = l === "English";
                  const selected = locked || languages.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => !locked && setLanguages((prev) => toggle(prev, l))}
                      className={cn(
                        "min-h-11 rounded-xl border px-3 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected
                          ? "border-primary bg-primary/20 text-foreground shadow-glow"
                          : "border-white/10 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        locked && "cursor-default opacity-90",
                      )}
                    >
                      {l}
                      {locked && " ✓"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {hint && (
          <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
            {hint}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (step === 1 ? onOpenChange(false) : setStep((s) => s - 1))}
            className="min-h-11 gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <Button
            type="button"
            onClick={next}
            disabled={!stepValid}
            className="min-h-11 flex-1 gap-1.5 bg-gradient-brand font-black uppercase tracking-wide text-primary-foreground shadow-glow sm:flex-none"
          >
            {step === TOTAL_STEPS ? (
              <>
                <Check className="h-4 w-4" />
                {submitLabel}
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
