import { createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Sparkles, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/create-portal")({
  component: CreatePortalWizard,
});

const LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Japanese", "Korean", "Mandarin", "Hindi", "Arabic"];

const TAG_LIBRARY = [
  "pop", "rock", "hip-hop", "trap", "r&b", "soul", "jazz", "blues", "country", "folk",
  "indie", "alternative", "punk", "metal", "electronic", "house", "techno", "edm",
  "lo-fi", "ambient", "synthwave", "retro", "80s", "90s", "acoustic", "piano",
  "orchestral", "cinematic", "reggae", "latin", "salsa", "bossa nova", "afrobeat",
  "k-pop", "j-pop", "anime", "dreamy", "melancholic", "uplifting", "energetic", "chill",
];

function CreatePortalWizard() {
  const { isAdmin, isLoading } = useRole();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [language, setLanguage] = useState("Spanish");
  const [tags, setTags] = useState<string[]>([]);

  const slugClean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length >= 6 ? prev : [...prev, tag],
    );
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Portal name required");
      if (!slugClean) throw new Error("URL slug required");
      if (tags.length < 4 || tags.length > 6) throw new Error("Pick between 4 and 6 style tags");
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("portals").insert({
        name: name.trim(),
        slug: slugClean,
        language,
        style_tags: tags,
        created_by: user?.id ?? null,
      }).select("slug").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Portal /portal/${data.slug} created`);
      navigate({ to: "/admin" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <DashboardShell title="Create Portal">
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </DashboardShell>
    );
  }
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <DashboardShell title="Create Portal">
      <div className="mx-auto max-w-2xl">
        <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to admin
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand">
              <Wand2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">New Portal</h2>
              <p className="text-sm text-muted-foreground">Configure a themed song-creation page.</p>
            </div>
          </div>

          <div className="grid gap-5">
            <div>
              <Label htmlFor="name">Portal name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                }}
                placeholder="Latin Nights"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="slug">URL slug</Label>
              <div className="mt-2 flex overflow-hidden rounded-md border border-input bg-background">
                <span className="grid place-items-center px-3 text-sm text-muted-foreground">/portal/</span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="latin-nights"
                  className="border-0 focus-visible:ring-0"
                />
              </div>
              {slug && slugClean !== slug && (
                <p className="mt-1 text-xs text-muted-foreground">Will be saved as <span className="font-mono">{slugClean}</span></p>
              )}
            </div>

            <div>
              <Label>Lyrics language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Preset style tags ({tags.length}/6 · pick 4–6)</Label>
                {tags.length > 0 && (
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setTags([])}>Clear</button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {TAG_LIBRARY.map((tag) => {
                  const selected = tags.includes(tag);
                  const disabled = !selected && tags.length >= 5;
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      disabled={disabled}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        selected
                          ? "border-primary bg-primary/15 text-primary"
                          : disabled
                            ? "border-border text-muted-foreground/40"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              size="lg"
              disabled={create.isPending || !name.trim() || !slugClean || tags.length !== 5}
              onClick={() => create.mutate()}
              className="bg-gradient-brand text-primary-foreground"
            >
              {create.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                : <><Sparkles className="mr-2 h-4 w-4" /> Create portal</>}
            </Button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
