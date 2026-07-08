import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Trophy, Timer, Music2, RefreshCw, Share2, Copy, Wand2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/challenge")({
  component: ChallengePage,
  head: () => ({
    meta: [
      { title: "Daily Lyric Challenge — OG Streamz" },
      { name: "description", content: "A fresh family-friendly song prompt every day. Beat the clock, cook up a track, share it with the OG crew." },
      { property: "og:title", content: "Daily Lyric Challenge — OG Streamz" },
      { property: "og:description", content: "One new prompt a day. Anyone can play. Turn it into a song in 60 seconds." },
    ],
  }),
});

/* ---------- Family-friendly prompts (rotates daily) ---------- */
type Prompt = {
  emoji: string;
  title: string;
  brief: string;
  vibe: string;
  hint: string;
};

const PROMPTS: Prompt[] = [
  { emoji: "🚀", title: "Rocket to the Moon", brief: "A hero's anthem about blasting off on a big adventure.", vibe: "Epic pop", hint: "3, 2, 1… lift-off!" },
  { emoji: "🐉", title: "The Friendly Dragon", brief: "A bedtime story about a dragon who bakes cookies for the village.", vibe: "Folk lullaby", hint: "Warm, cozy, magical" },
  { emoji: "🏖️", title: "Summer Skate Day", brief: "Sunshine, skateboards, ice cream and a busted knee that heals fast.", vibe: "Surf rock", hint: "Windows-down energy" },
  { emoji: "🎂", title: "Grandma's Kitchen", brief: "A love letter to family, food, and the best hugs on Earth.", vibe: "Soul ballad", hint: "From the heart" },
  { emoji: "🌧️", title: "Puddle Jumper", brief: "A kid stomping in rain puddles, laughing at the thunder.", vibe: "Indie folk", hint: "Playful & bright" },
  { emoji: "🎮", title: "Boss Level", brief: "You vs the final boss. No cheat codes, just heart.", vibe: "Chiptune rock", hint: "Press START" },
  { emoji: "🐕", title: "My Best Friend Has Four Paws", brief: "An ode to a very good dog who always waits at the door.", vibe: "Country pop", hint: "Tail-wagging joy" },
  { emoji: "🌈", title: "After the Storm", brief: "A hopeful song about tough days ending in rainbows.", vibe: "Uplifting anthem", hint: "Everyone sings along" },
  { emoji: "🚲", title: "First Bike Ride", brief: "Wobbles, wipeouts, and the moment you finally fly.", vibe: "Acoustic pop", hint: "Look, no hands!" },
  { emoji: "🥞", title: "Saturday Pancakes", brief: "The smell of maple syrup, cartoons, pajamas till noon.", vibe: "Lo-fi jazz", hint: "Weekend vibes" },
  { emoji: "🎪", title: "The Traveling Circus", brief: "Big-top magic — jugglers, elephants, popcorn skies.", vibe: "Marching band pop", hint: "Ta-da!" },
  { emoji: "🧑‍🚀", title: "Space Camp Diary", brief: "A young explorer sending postcards home from orbit.", vibe: "Synthwave", hint: "Starlight & wonder" },
  { emoji: "🎃", title: "Neighborhood Costume Parade", brief: "Everyone dressed up, candy trades, spooky laughs, no scares.", vibe: "Halloween pop", hint: "Silly, not scary" },
  { emoji: "❄️", title: "Snow Day Symphony", brief: "School's closed! Sledding, cocoa, snowman crews.", vibe: "Cinematic pop", hint: "Sparkling & bright" },
  { emoji: "🎨", title: "Museum of Weird Art", brief: "A kid explains modern art like a professor. Chaos ensues.", vibe: "Quirky indie", hint: "Funny & clever" },
  { emoji: "🌊", title: "Message in a Bottle", brief: "A letter tossed into the sea reaches a friend across the world.", vibe: "Cinematic folk", hint: "Big feels" },
  { emoji: "🦸", title: "Everyday Hero", brief: "Not capes — kindness. Small acts that save the day.", vibe: "Anthemic pop", hint: "Feel-good chorus" },
  { emoji: "🎂", title: "Birthday Countdown", brief: "It's someone's big day — party, cake, and one huge wish.", vibe: "Celebration pop", hint: "Confetti-cannon energy" },
  { emoji: "🎣", title: "Fishing With Dad", brief: "Quiet lake, big story about the one that got away.", vibe: "Americana", hint: "Slow & sweet" },
  { emoji: "🌸", title: "Spring Cleaning Dance-Off", brief: "Turn up the music, mop the floor, don't stop till it shines.", vibe: "Funk pop", hint: "Groovy" },
  { emoji: "🚂", title: "Midnight Train Adventure", brief: "A curious traveler heading somewhere new, ticket in hand.", vibe: "Cinematic indie", hint: "All aboard!" },
  { emoji: "🎈", title: "Runaway Balloon", brief: "A red balloon drifts across town — who catches it?", vibe: "Whimsical pop", hint: "Wide-eyed wonder" },
  { emoji: "🌙", title: "Bedtime Wish", brief: "A gentle goodnight song for the whole world to hear.", vibe: "Lullaby", hint: "Softly, softly" },
  { emoji: "🎤", title: "Karaoke Champion", brief: "Regular hero grabs the mic — the crowd goes wild.", vibe: "Feel-good pop", hint: "Bring the hook" },
  { emoji: "🐢", title: "Slow And Steady", brief: "A tortoise reminds us that finishing counts more than speed.", vibe: "Reggae", hint: "Chill & wise" },
  { emoji: "🍕", title: "Pizza Party Anthem", brief: "Friday night, everyone's invited, extra cheese for all.", vibe: "Pop punk (clean)", hint: "Big chorus" },
  { emoji: "🏕️", title: "Campfire Ghost-ish Story", brief: "A silly not-scary tale told around marshmallows and stars.", vibe: "Acoustic", hint: "Wholesome giggles" },
  { emoji: "🌻", title: "Garden of Kindness", brief: "Every kind word plants a flower. Soon the whole street blooms.", vibe: "Soulful pop", hint: "Gentle & uplifting" },
  { emoji: "🎁", title: "The Perfect Present", brief: "It's not the box — it's who it's for.", vibe: "Warm ballad", hint: "Tug at heartstrings" },
  { emoji: "🕺", title: "Grandpa's Disco Move", brief: "One legendary move at the family wedding. Everyone copies.", vibe: "Disco funk", hint: "Boogie down" },
  { emoji: "🐋", title: "Song of the Whales", brief: "Whales singing across oceans, telling stories older than time.", vibe: "Ambient cinematic", hint: "Vast & beautiful" },
  { emoji: "🎢", title: "Roller Coaster Rush", brief: "That first drop — screams, giggles, hands in the air.", vibe: "Big pop", hint: "Fast, bright, fun" },
];

/* Deterministic daily index (same for everyone worldwide, changes at UTC midnight) */
function todayIndex(): number {
  const d = new Date();
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.floor(utc / 86_400_000);
  return days % PROMPTS.length;
}

function useCountdownToMidnight() {
  const [msLeft, setMsLeft] = useState(() => msUntilMidnight());
  useEffect(() => {
    const t = setInterval(() => setMsLeft(msUntilMidnight()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(msLeft / 3_600_000);
  const m = Math.floor((msLeft % 3_600_000) / 60_000);
  const s = Math.floor((msLeft % 60_000) / 1000);
  return { h, m, s };
}
function msUntilMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function ChallengePage() {
  const [surpriseIdx, setSurpriseIdx] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const idx = surpriseIdx ?? todayIndex();
  const prompt = PROMPTS[idx];
  const { h, m, s } = useCountdownToMidnight();

  // 60-second creative timer
  useEffect(() => {
    if (!started) return;
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [started, secondsLeft]);

  const fullPrompt = useMemo(
    () => `${prompt.title} — ${prompt.brief} Vibe: ${prompt.vibe}.`,
    [prompt],
  );

  const start = () => {
    setStarted(true);
    setSecondsLeft(60);
    try {
      navigator.vibrate?.(30);
    } catch {
      /* noop */
    }
    // Stash prompt so Library can pre-fill (safe: sessionStorage, no PII)
    try {
      sessionStorage.setItem(
        "og:challenge-prompt",
        JSON.stringify({ title: prompt.title, brief: prompt.brief, vibe: prompt.vibe, fullPrompt }),
      );
    } catch {
      /* noop */
    }
    toast.success(`Challenge started — ${prompt.title}!`, {
      description: "Prompt saved. Head to the Studio to lay it down.",
    });
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      toast.success("Prompt copied — paste it into the Studio.");
    } catch {
      toast.error("Couldn't copy. Long-press the prompt to select it.");
    }
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.origin + "/challenge" : "/challenge";
    const text = `Today's OG Challenge: ${prompt.emoji} ${prompt.title} — ${prompt.brief}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "OG Daily Challenge", text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Link copied — share with your crew!");
      }
    } catch {
      /* user cancelled */
    }
  };

  const surprise = () => {
    let next = Math.floor(Math.random() * PROMPTS.length);
    if (next === idx) next = (next + 1) % PROMPTS.length;
    setSurpriseIdx(next);
    setStarted(false);
    setSecondsLeft(60);
  };

  const reset = () => {
    setSurpriseIdx(null);
    setStarted(false);
    setSecondsLeft(60);
  };

  const timerLabel =
    secondsLeft > 0 ? `${secondsLeft}s` : "Time's up!";
  const timerPct = Math.max(0, Math.min(100, (secondsLeft / 60) * 100));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-16 pt-2 sm:gap-8">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest">
            <Trophy className="h-3.5 w-3.5" /> Daily Challenge
          </Badge>
          <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-xs">
            <Timer className="h-3.5 w-3.5" /> New prompt in {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
          </Badge>
          {surpriseIdx !== null && (
            <Badge className="gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-xs text-accent-foreground">
              Surprise pick
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
          Today's Song Challenge
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          One prompt. Any age. Turn it into a song and share it with the crew.
        </p>
      </header>

      {/* The Prompt card */}
      <Card className="relative overflow-hidden border-2 border-white/10 bg-gradient-to-br from-primary/10 via-card/70 to-accent/10 shadow-[0_24px_60px_-20px_rgba(80,60,255,0.45)] backdrop-blur-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-24 opacity-30 [background:conic-gradient(from_0deg,oklch(0.55_0.22_268/0.4),transparent_35%,oklch(0.7_0.22_25/0.35)_60%,transparent_85%,oklch(0.55_0.22_268/0.4))] animate-[spin_28s_linear_infinite] blur-3xl"
        />
        <CardHeader className="relative">
          <CardTitle className="flex flex-wrap items-center gap-3 text-2xl sm:text-3xl">
            <span className="text-4xl sm:text-5xl" aria-hidden>{prompt.emoji}</span>
            <span>{prompt.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative flex flex-col gap-5">
          <p className="text-lg leading-relaxed text-foreground/90 sm:text-xl">
            {prompt.brief}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <Music2 className="h-3.5 w-3.5" /> {prompt.vibe}
            </Badge>
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <Sparkles className="h-3.5 w-3.5" /> Tip: {prompt.hint}
            </Badge>
          </div>

          {/* Timer */}
          {started && (
            <div className="rounded-xl border border-white/10 bg-background/40 p-4">
              <div className="mb-2 flex items-center justify-between text-sm font-bold">
                <span className="inline-flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" />
                  Creative burst
                </span>
                <span className={secondsLeft <= 10 && secondsLeft > 0 ? "text-primary animate-pulse" : ""}>
                  {timerLabel}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${timerPct}%` }}
                />
              </div>
              {secondsLeft === 0 && (
                <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  <PartyPopper className="h-4 w-4" />
                  Time's up! Head to the Studio and finish strong.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!started ? (
              <Button
                size="lg"
                onClick={start}
                className="gap-2 rounded-full px-6 text-base font-black shadow-glow"
              >
                <Sparkles className="h-5 w-5" /> Start Challenge
              </Button>
            ) : (
              <Link
                to="/library"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-black text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                <Wand2 className="h-5 w-5" /> Open Studio
              </Link>
            )}

            <Button variant="outline" size="lg" onClick={copyPrompt} className="gap-2 rounded-full">
              <Copy className="h-4 w-4" /> Copy prompt
            </Button>
            <Button variant="outline" size="lg" onClick={share} className="gap-2 rounded-full">
              <Share2 className="h-4 w-4" /> Share
            </Button>
            <Button variant="ghost" size="lg" onClick={surprise} className="gap-2 rounded-full">
              <RefreshCw className="h-4 w-4" /> Surprise me
            </Button>
            {surpriseIdx !== null && (
              <Button variant="ghost" size="lg" onClick={reset} className="rounded-full">
                Back to today's
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { n: "1", t: "Read the prompt", d: "One fresh idea a day — everyone gets the same one." },
          { n: "2", t: "Cook a song", d: "Use the Studio. Beginners: pick a vibe. Pros: freestyle." },
          { n: "3", t: "Share it", d: "Post it to the Community or send to a friend for a smile." },
        ].map((step) => (
          <Card key={step.n} className="border border-white/10 bg-card/60 backdrop-blur">
            <CardContent className="flex gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-lg font-black text-primary">
                {step.n}
              </div>
              <div>
                <div className="font-bold">{step.t}</div>
                <p className="text-sm text-muted-foreground">{step.d}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        All prompts are family-friendly. Bring the whole crew.
      </p>
    </div>
  );
}
