import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
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

export type CreationFlow = "scratch" | "memory" | "tribute" | "messenger";

const FLOW_COPY: Record<CreationFlow, { title: string; description: string }> = {
  scratch: {
    title: "Create from scratch",
    description: "Start a blank brief and shape the song from the ground up.",
  },
  memory: {
    title: "From a memory",
    description: "Turn a story, moment, or place into a personalised track.",
  },
  tribute: {
    title: "Dedication or tribute",
    description: "Write a song for someone you love, or in someone's honour.",
  },
  messenger: {
    title: "With OG Messenger",
    description: "Brainstorm and co-write with your AI co-producer.",
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
  theme: "",
};

export function CreateSongDialog({ flow, onClose, onSubmit }: CreateSongDialogProps) {
  const [state, setState] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  if (!flow) return null;
  const copy = FLOW_COPY[flow];

  function update<K extends keyof typeof EMPTY>(key: K, value: string) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.theme.trim() && !state.memories.trim() && !state.focusPerson.trim()) {
      toast.error("Tell us a bit about the song — focus, memory, or theme.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ flow: flow!, ...state });
      setState(EMPTY);
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

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <Field
            id="title"
            label="Working title"
            placeholder="e.g. For Nan"
            value={state.title}
            onChange={(v) => update("title", v)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="focusPerson"
              label="Who is the song about?"
              placeholder="Name or 'me'"
              value={state.focusPerson}
              onChange={(v) => update("focusPerson", v)}
            />
            <Field
              id="relationship"
              label="Relationship"
              placeholder="Mum, partner, friend…"
              value={state.relationship}
              onChange={(v) => update("relationship", v)}
            />
          </div>

          <Field
            id="places"
            label="Important places"
            placeholder="Where does this story live?"
            value={state.places}
            onChange={(v) => update("places", v)}
          />

          <Area
            id="memories"
            label="Memories or moments"
            placeholder="Specific moments, scenes, dates…"
            value={state.memories}
            onChange={(v) => update("memories", v)}
          />

          <Field
            id="family"
            label="Family or people to reference"
            placeholder="Names that should appear"
            value={state.family}
            onChange={(v) => update("family", v)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="mood" label="Mood" placeholder="Warm, hopeful…" value={state.mood} onChange={(v) => update("mood", v)} />
            <Field id="genre" label="Genre / style" placeholder="Acoustic folk" value={state.genre} onChange={(v) => update("genre", v)} />
            <Field id="lyricalStyle" label="Lyrical style" placeholder="Story-driven" value={state.lyricalStyle} onChange={(v) => update("lyricalStyle", v)} />
          </div>

          <Area
            id="theme"
            label="Message or theme"
            placeholder="What should this song say?"
            value={state.theme}
            onChange={(v) => update("theme", v)}
          />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id, label, value, onChange, placeholder,
}: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Area({
  id, label, value, onChange, placeholder,
}: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} />
    </div>
  );
}

export function composePromptFromDraft(d: SongBriefDraft): string {
  const lines: string[] = [];
  if (d.focusPerson) lines.push(`About: ${d.focusPerson}${d.relationship ? ` (${d.relationship})` : ""}`);
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
