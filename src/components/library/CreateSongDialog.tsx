import { useState } from "react";
import { Loader2, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type CreationFlow = "scratch" | "memory" | "tribute" | "messenger";

const FLOW_COPY: Record<CreationFlow, { title: string; description: string }> = {
  scratch: {
    title: "Create from scratch",
    description: "Tap a few vibes — add words only if you want.",
  },
  memory: {
    title: "From a memory",
    description: "Pick the feeling, drop the moment. Everything is optional.",
  },
  tribute: {
    title: "Dedication or tribute",
    description: "For someone special. Tap what fits, add a note if you like.",
  },
  messenger: {
    title: "With OG Messenger",
    description: "Brainstorm with OG Bot. Pick a starting vibe.",
  },
};

export interface SongBriefDraft {
  flow: CreationFlow;
  title: string;
  focusPerson: string;
  relationship: string;
  places: string;
  memories: string;
  family: string;
  mood: string;
  genre: string;
  lyricalStyle: string;
  language: string;
  theme: string;
}

interface CreateSongDialogProps {
  flow: CreationFlow | null;
  onClose: () => void;
  onSubmit: (draft: SongBriefDraft) => Promise<void> | void;
}

const EMPTY: Omit<SongBriefDraft, "flow"> = {
  title: "",
  focusPerson: "",
  relationship: "",
  places: "",
  memories: "",
  family: "",
  mood: "",
  genre: "",
  lyricalStyle: "",
  language: "English",
  theme: "",
};

const MOODS = ["Warm", "Hopeful", "Heartfelt", "Hype", "Sad", "Romantic", "Nostalgic", "Chill", "Triumphant", "Cheeky"];
const GENRES = ["Rap", "Drill", "Pop", "Afrobeats", "R&B", "Dance", "Acoustic", "Ballad", "Reggae", "Indie"];
const STYLES = ["Story-driven", "Punchy bars", "Sing-along hook", "Spoken word", "Anthem", "Lullaby"];
const RELATIONSHIPS = ["Mum", "Dad", "Partner", "Best friend", "Sibling", "Kids", "Crew", "Myself"];
const LANGUAGES = ["English", "Spanish", "French", "Portuguese", "Hindi", "Urdu", "Punjabi", "Arabic", "Swahili", "Patois", "Yoruba", "German", "Italian", "Tagalog"];

export function CreateSongDialog({ flow, onClose, onSubmit }: CreateSongDialogProps) {
  const [state, setState] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!flow) return null;
  const copy = FLOW_COPY[flow];

  function update<K extends keyof typeof EMPTY>(key: K, value: string) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ flow: flow!, ...state });
      setState(EMPTY);
      setShowDetails(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <ChipSection
            label="Mood"
            hint="How should it feel?"
            options={MOODS}
            value={state.mood}
            onChange={(v) => update("mood", v)}
            customPlaceholder="Add your own mood…"
          />

          <ChipSection
            label="Genre"
            hint="Pick a sound"
            options={GENRES}
            value={state.genre}
            onChange={(v) => update("genre", v)}
            customPlaceholder="Add your own genre…"
          />

          <ChipSection
            label="Lyrical style"
            hint="How should it tell the story?"
            options={STYLES}
            value={state.lyricalStyle}
            onChange={(v) => update("lyricalStyle", v)}
            customPlaceholder="Add your own style…"
          />

          <ChipSection
            label="Language"
            hint="What language should the lyrics be in?"
            options={LANGUAGES}
            value={state.language}
            onChange={(v) => update("language", v)}
            customPlaceholder="Add another language…"
          />

          {(flow === "memory" || flow === "tribute") && (
            <ChipSection
              label="Who it's for"
              hint="Tap one or type a name below"
              options={RELATIONSHIPS}
              value={state.relationship}
              onChange={(v) => update("relationship", v)}
              customPlaceholder="Or someone else…"
            />
          )}

          {/* Optional extra details — collapsed by default */}
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-border bg-background/30 px-4 py-3 text-left text-sm font-semibold transition hover:bg-background/50"
          >
            <span>Add more details (optional)</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showDetails && "rotate-180")} />
          </button>

          {showDetails && (
            <div className="space-y-4 rounded-2xl border border-border bg-background/30 p-4">
              <Field id="title" label="Working title" placeholder="e.g. For Nan" value={state.title} onChange={(v) => update("title", v)} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="focusPerson" label="About who" placeholder="Name or 'me'" value={state.focusPerson} onChange={(v) => update("focusPerson", v)} />
                <Field id="places" label="Places" placeholder="Where it lives" value={state.places} onChange={(v) => update("places", v)} />
              </div>
              <Area id="memories" label="Memories or moments" placeholder="Specific scenes, dates…" value={state.memories} onChange={(v) => update("memories", v)} />
              <Field id="family" label="People to reference" placeholder="Names to mention" value={state.family} onChange={(v) => update("family", v)} />
              <Area id="theme" label="Message or theme" placeholder="What should this song say?" value={state.theme} onChange={(v) => update("theme", v)} />
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground">
            Everything is optional — even an empty brief works.
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="font-semibold">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <><Sparkles className="mr-2 h-4 w-4" /> Save draft</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChipSection({
  label, hint, options, value, onChange, customPlaceholder,
}: {
  label: string;
  hint?: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  customPlaceholder?: string;
}) {
  const isCustom = value !== "" && !options.includes(value);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? "" : opt)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-glow"
                  : "border-border bg-background/40 text-foreground hover:border-primary/50 hover:bg-primary/10",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <Input
        value={isCustom ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={customPlaceholder ?? "Add your own…"}
        className="h-9 text-sm"
      />
    </div>
  );
}

function Field({
  id, label, value, onChange, placeholder,
}: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Area({
  id, label, value, onChange, placeholder,
}: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} />
    </div>
  );
}

export function composePromptFromDraft(d: SongBriefDraft): string {
  const lines: string[] = [];
  if (d.focusPerson) lines.push(`About: ${d.focusPerson}${d.relationship ? ` (${d.relationship})` : ""}`);
  else if (d.relationship) lines.push(`For: ${d.relationship}`);
  if (d.places) lines.push(`Places: ${d.places}`);
  if (d.memories) lines.push(`Memories: ${d.memories}`);
  if (d.family) lines.push(`People to reference: ${d.family}`);
  if (d.mood || d.genre || d.lyricalStyle) {
    lines.push(
      `Style: ${[d.mood, d.genre, d.lyricalStyle].filter(Boolean).join(" · ")}`,
    );
  }
  if (d.theme) lines.push(`Message: ${d.theme}`);
  return lines.join("\n");
}
