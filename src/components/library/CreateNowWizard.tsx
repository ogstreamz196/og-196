import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  defaultLanguage = "English",
  submitLabel = "Create my song",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete: (result: WizardResult) => void;
  defaultLanguage?: string;
  submitLabel?: string;
}) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);

  // Fresh start each time the wizard opens.
  useEffect(() => {
    if (!open) return;
    setStep(1);
  }, [open]);

  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return title.trim().length > 0;
      case 2:
        return subjectName.trim().length > 0;
      case 3:
        return description.trim().length >= 12;
      case 4:
        return style.trim().length > 0;
      default:
        return language.trim().length > 0;
    }
  }, [step, title, subjectName, description, style, language]);

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
        return "Pick one style.";
      default:
        return "Pick a language.";
    }
  }, [step, stepValid]);

  function next() {
    if (!stepValid) return;
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    onComplete({
      title: title.trim(),
      subjectName: subjectName.trim(),
      description: description.trim(),
      style: style.trim(),
      language: language.trim(),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-2xl">
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
            {step === 4 && "One style shapes the whole beat."}
            {step === 5 && "The lyrics will be written in this language."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[168px] py-1 transition-opacity duration-200">
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
            <div
              role="radiogroup"
              aria-label="Track style"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {STYLES.map((s) => {
                const selected = style === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setStyle(s)}
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
          )}

          {step === 5 && (
            <div
              role="radiogroup"
              aria-label="Language"
              className="grid max-h-[280px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3"
            >
              {POOLS.language.map((l) => {
                const selected = language === l;
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setLanguage(l)}
                    className={cn(
                      "min-h-11 rounded-xl border px-3 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selected
                        ? "border-primary bg-primary/20 text-foreground shadow-glow"
                        : "border-white/10 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {l}
                  </button>
                );
              })}
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
