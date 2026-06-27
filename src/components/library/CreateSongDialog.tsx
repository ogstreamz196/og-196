import { useState } from "react";
import { Loader2, Sparkles, ChevronDown, Shuffle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
    title: "With OG Bot",
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
const LANGUAGES = ["English", "Spanish", "French", "Portuguese", "Hindi", "Gujarati", "Marathi", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam", "Urdu", "Punjabi", "Arabic", "Swahili", "Patois", "Yoruba", "German", "Italian", "Tagalog"];

const THEMES = [
  "A love letter that finally says it out loud",
  "Roast them with love on their birthday",
  "A tribute to someone we lost too soon",
  "Hometown pride — where I'm from made me",
  "Glow-up anthem after a tough year",
  "Late-night drive, windows down, no worries",
  "Apology song that actually means it",
  "Best friend appreciation, every inside joke",
  "Wedding day vows turned into a hook",
  "Underdog story — they doubted me, watch this",
  "Mum's strength, told the way she'd never tell it",
  "First-day-at-a-new-job hype track",
];

const PRESETS: { label: string; emoji: string; values: Partial<typeof EMPTY> }[] = [
  { label: "Birthday hype", emoji: "🎉", values: { mood: "Hype", genre: "Afrobeats", lyricalStyle: "Sing-along hook", theme: "Roast them with love on their birthday" } },
  { label: "Love letter", emoji: "💌", values: { mood: "Romantic", genre: "R&B", lyricalStyle: "Story-driven", theme: "A love letter that finally says it out loud" } },
  { label: "In memory", emoji: "🕊️", values: { mood: "Heartfelt", genre: "Ballad", lyricalStyle: "Story-driven", theme: "A tribute to someone we lost too soon" } },
  { label: "Hometown anthem", emoji: "🏟️", values: { mood: "Triumphant", genre: "Drill", lyricalStyle: "Anthem", theme: "Hometown pride — where I'm from made me" } },
  { label: "Chill vibes", emoji: "🌊", values: { mood: "Chill", genre: "Indie", lyricalStyle: "Spoken word", theme: "Late-night drive, windows down, no worries" } },
  { label: "Glow-up", emoji: "✨", values: { mood: "Triumphant", genre: "Pop", lyricalStyle: "Anthem", theme: "Glow-up anthem after a tough year" } },
  { label: "Wedding day", emoji: "💍", values: { mood: "Romantic", genre: "Acoustic", lyricalStyle: "Story-driven", theme: "Wedding day vows turned into a hook" } },
  { label: "Apology", emoji: "🙏", values: { mood: "Heartfelt", genre: "R&B", lyricalStyle: "Spoken word", theme: "Apology song that actually means it" } },
  { label: "Best friend", emoji: "🤝", values: { mood: "Warm", genre: "Pop", lyricalStyle: "Sing-along hook", theme: "Best friend appreciation, every inside joke" } },
  { label: "Underdog", emoji: "🥊", values: { mood: "Hype", genre: "Rap", lyricalStyle: "Punchy bars", theme: "Underdog story — they doubted me, watch this" } },
  { label: "For Mum", emoji: "🌷", values: { mood: "Nostalgic", genre: "Ballad", lyricalStyle: "Story-driven", theme: "Mum's strength, told the way she'd never tell it" } },
  { label: "Heartbreak", emoji: "💔", values: { mood: "Sad", genre: "R&B", lyricalStyle: "Story-driven", theme: "A love letter that finally says it out loud" } },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function CreateSongDialog({ flow, onClose, onSubmit }: CreateSongDialogProps) {
  const [state, setState] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  if (!flow) return null;
  const copy = FLOW_COPY[flow];

  function update<K extends keyof typeof EMPTY>(key: K, value: string) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function shuffle() {
    const preset = pick(PRESETS);
    setState((s) => ({
      ...s,
      mood: pick(MOODS),
      genre: pick(GENRES),
      lyricalStyle: pick(STYLES),
      theme: preset.values.theme ?? pick(THEMES),
    }));
  }

  function applyPreset(values: Partial<typeof EMPTY>) {
    setState((s) => ({ ...s, ...values }));
    if (values.theme) setShowDetails(true);
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

  const showRelationship = flow === "memory" || flow === "tribute";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border bg-card/60 px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {copy.title}
          </SheetTitle>
          <SheetDescription>{copy.description}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {/* Quick-start: presets + shuffle */}
            <div className="rounded-2xl border border-border bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Not sure? Start here
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={shuffle}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Shuffle
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.values)}
                    className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium transition hover:border-primary/60 hover:bg-primary/10"
                  >
                    <span className="mr-1">{p.emoji}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact dropdown selectors */}
            <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
              <SelectRow
                id="mood"
                label="Mood"
                value={state.mood}
                placeholder="Pick a feeling"
                options={MOODS}
                open={openSection === "mood"}
                onToggle={() => setOpenSection(openSection === "mood" ? null : "mood")}
                onChange={(v) => update("mood", v)}
              />
              <SelectRow
                id="genre"
                label="Genre"
                value={state.genre}
                placeholder="Pick a sound"
                options={GENRES}
                open={openSection === "genre"}
                onToggle={() => setOpenSection(openSection === "genre" ? null : "genre")}
                onChange={(v) => update("genre", v)}
              />
              <SelectRow
                id="style"
                label="Lyrical style"
                value={state.lyricalStyle}
                placeholder="How it tells the story"
                options={STYLES}
                open={openSection === "style"}
                onToggle={() => setOpenSection(openSection === "style" ? null : "style")}
                onChange={(v) => update("lyricalStyle", v)}
              />
              <SelectRow
                id="language"
                label="Language"
                value={state.language}
                placeholder="English"
                options={LANGUAGES}
                open={openSection === "language"}
                onToggle={() => setOpenSection(openSection === "language" ? null : "language")}
                onChange={(v) => update("language", v)}
              />
              {showRelationship && (
                <SelectRow
                  id="relationship"
                  label="Who it's for"
                  value={state.relationship}
                  placeholder="Tap one"
                  options={RELATIONSHIPS}
                  open={openSection === "relationship"}
                  onToggle={() => setOpenSection(openSection === "relationship" ? null : "relationship")}
                  onChange={(v) => update("relationship", v)}
                  last
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-dashed border-border bg-background/30 px-4 py-2.5 text-left text-sm font-semibold transition hover:bg-background/50"
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
          </div>

          <SheetFooter className="border-t border-border bg-card/60 px-6 py-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="font-semibold">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <><Sparkles className="mr-2 h-4 w-4" /> Save draft</>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SelectRow({
  id, label, value, placeholder, options, open, onToggle, onChange, last,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  open: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  last?: boolean;
}) {
  const isCustom = value !== "" && !options.includes(value);
  return (
    <div className={cn(!last && "border-b border-border")}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-background/40"
      >
        <span className="text-sm font-semibold">{label}</span>
        <span className="flex items-center gap-2 min-w-0">
          <span className={cn("truncate text-sm", value ? "text-foreground" : "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border bg-background/20 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {options.map((opt) => {
              const active = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange(active ? "" : opt)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/60 hover:border-primary/50 hover:bg-primary/10",
                  )}
                >
                  {active && <Check className="h-3 w-3" />}
                  {opt}
                </button>
              );
            })}
          </div>
          <Input
            id={id}
            value={isCustom ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Or type your own…"
            className="h-8 text-xs"
          />
        </div>
      )}
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
  if (d.language) lines.push(`Language: write the lyrics in ${d.language}`);
  return lines.join("\n");
}
