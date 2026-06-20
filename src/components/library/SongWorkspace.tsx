import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, FileText, History, MessageSquareMore, Wand2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Song } from "@/components/SongCard";

type WorkspaceSong = Song & { lyrics?: string | null };

interface Props {
  song: WorkspaceSong;
  onSaved?: () => void;
}

/**
 * Editable song workspace shown beneath the player card.
 * Saves title / brief (prompt) / lyrics to the songs row.
 * Versioning and Suno handoff are intentionally placeholders for now.
 */
export function SongWorkspace({ song, onSaved }: Props) {
  const [title, setTitle] = useState(song.title ?? "");
  const [brief, setBrief] = useState(song.prompt ?? "");
  const [lyrics, setLyrics] = useState(song.lyrics ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    title !== (song.title ?? "") ||
    brief !== (song.prompt ?? "") ||
    lyrics !== (song.lyrics ?? "");

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("songs")
        .update({
          title: title.trim() || null,
          prompt: brief,
          lyrics: lyrics.trim() || null,
        })
        .eq("id", song.id);
      if (error) throw error;
      toast.success("Saved");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Brief + lyrics */}
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4" /> Song brief
            </CardTitle>
            <CardDescription>Title, the story, and what the song should say.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="song-title">Title</Label>
              <Input
                id="song-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="song-brief">Brief</Label>
              <Textarea
                id="song-brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={6}
                placeholder="Who is the song about, the mood, references, memories…"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wand2 className="h-4 w-4" /> Lyrics workspace
            </CardTitle>
            <CardDescription>
              Draft, edit and refine lyrics. Suno generation handoff lands here next.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              rows={14}
              placeholder={"[Verse 1]\n…\n\n[Chorus]\n…"}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      {/* Side rail */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquareMore className="h-4 w-4" /> Need a hand?
            </CardTitle>
            <CardDescription>Brainstorm with OG Messenger.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full gap-2">
              <Link to="/messenger">
                Open OG Messenger <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-4 w-4" /> Version history
            </CardTitle>
            <CardDescription>Snapshots will appear here as you iterate.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No versions yet
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generation</CardTitle>
            <CardDescription>Suno prompt handoff</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant="outline" className="capitalize">{song.status}</Badge>
            <p className="text-xs text-muted-foreground">
              Once your brief and lyrics are ready, the generation pipeline will pick up from here.
            </p>
            <Button disabled className="w-full" variant="secondary">
              Send to generator (coming soon)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
