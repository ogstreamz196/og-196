import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Music2, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useSettings } from "@/hooks/use-settings";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SongCard, type Song } from "@/components/SongCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const COIN_COST = settings?.coins_per_generation ?? 3;
  const SONGS_PER_GEN = settings?.songs_per_generation ?? 2;
  const SAMPLE_SECONDS = settings?.sample_seconds ?? 30;
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [instrumental, setInstrumental] = useState(false);

  const recentQuery = useQuery({
    queryKey: ["recent-songs", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Song[]> => {
      const { data, error } = await supabase
        .from("songs").select("*")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as Song[];
    },
  });

  // Realtime: refresh list when a song updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("songs-home")
      .on("postgres_changes", { event: "*", schema: "public", table: "songs", filter: `user_id=eq.${user.id}` },
        () => recentQuery.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("suno-generate", {
        body: { prompt, style, title, lyrics, instrumental },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success(`Queued! ${SONGS_PER_GEN} songs will appear in your library when ready (30s – 2min).`);
      setPrompt(""); setLyrics(""); setTitle("");
      qc.invalidateQueries({ queryKey: ["recent-songs"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: Error) => {
      if (err.message.toLowerCase().includes("insufficient")) {
        toast.error("Not enough coins — buy more to keep generating.");
      } else {
        toast.error(err.message || "Generation failed");
      }
    },
  });

  const canGenerate = (prompt.trim() || lyrics.trim()) && (profile?.coin_balance ?? 0) >= COIN_COST;

  return (
    <DashboardShell title="Create">
      <div className="mx-auto max-w-4xl">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card bg-gradient-hero">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              Powered by 0G-Streamz
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              {profile?.display_name ? <>Hey, <span className="text-gradient-brand">{profile.display_name}</span> — turn ideas into songs</> : <>Turn ideas into <span className="text-gradient-brand">original songs</span></>}
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Describe a vibe, drop in custom lyrics, or both. Sonix generates a full track in under two minutes.
            </p>
          </div>
        </div>

        {/* Generator */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="prompt">Song style / vibe</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A melancholic synthwave ballad about late-night drives through neon streets..."
                rows={3}
                className="mt-2 resize-none"
                maxLength={500}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="title">Title (optional)</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neon Nights" className="mt-2" />
              </div>
              <div>
                <Label htmlFor="style">Genre tags (optional)</Label>
                <Input id="style" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="synthwave, dreamy, 80s" className="mt-2" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="lyrics">Custom lyrics (optional)</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch id="instrumental" checked={instrumental} onCheckedChange={setInstrumental} />
                  <Label htmlFor="instrumental" className="cursor-pointer">Instrumental</Label>
                </div>
              </div>
              <Textarea
                id="lyrics"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder="[Verse 1]&#10;..."
                rows={5}
                className="mt-2 resize-none font-mono text-sm"
                maxLength={3000}
                disabled={instrumental}
              />
            </div>

            <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                <Coins className="mr-1 inline h-3.5 w-3.5 text-coin" />
                <span className="font-semibold text-foreground">{COIN_COST} coins</span> gets you{" "}
                <span className="font-semibold text-foreground">{SONGS_PER_GEN} songs</span> with {SAMPLE_SECONDS}s previews.
                Downloads are free.
              </p>
              <Button
                size="lg"
                onClick={() => generate.mutate()}
                disabled={!canGenerate || generate.isPending}
                className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-90"
              >
                {generate.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate ({COIN_COST} coins)</>
                )}
              </Button>
            </div>
            {(profile?.coin_balance ?? 0) < COIN_COST && (
              <p className="text-sm text-destructive">You need {COIN_COST - (profile?.coin_balance ?? 0)} more coin(s). Visit Buy Coins.</p>
            )}
          </div>
        </div>

        {/* Recent */}
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Music2 className="h-5 w-5 text-primary" /> Recent generations
            </h3>
          </div>

          {recentQuery.isLoading ? (
            <div className="grid place-items-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : recentQuery.data && recentQuery.data.length > 0 ? (
            <div className="grid gap-3">
              {recentQuery.data.map((s) => <SongCard key={s.id} song={s} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
              No songs yet. Generate your first track above.
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
