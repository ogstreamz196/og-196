import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Music2,
  MessageSquareMore,
  Bot,
  ArrowRight,
  Headphones,
  Heart,
  Cake,
  Flame,
  BookOpen,
  Users,
  ShieldCheck,
  PlayCircle,
  Wand2,
  FileMusic,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  component: WelcomePage,
  head: () => ({
    meta: [
      { title: "OG Studio — Personalised music creation, powered by OG Bot" },
      {
        name: "description",
        content:
          "Turn real memories, names, places and life stories into personalised songs. Music Hub, OG Messenger and a floating OG Bot assistant — one premium music platform.",
      },
      { property: "og:title", content: "OG Studio — Personalised music creation, powered by OG Bot" },
      {
        property: "og:description",
        content:
          "Create personalised music from real memories. Music Hub + OG Messenger + floating OG Bot assistant.",
      },
    ],
  }),
});

function WelcomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <BackgroundFx />
      <TopNav />
      <Hero />
      <HowItWorks />
      <ProductSurfaces />
      <UseCases />
      <FinalCta />
      <Footer />
    </main>
  );
}

function BackgroundFx() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.18),transparent_70%)] blur-3xl" />
      <div className="absolute bottom-[-200px] right-[-120px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--accent)/0.16),transparent_70%)] blur-3xl" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.6))]" />
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/welcome" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">OG Bot</span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Music Hub
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#how" className="transition hover:text-foreground">How it works</a>
          <a href="#product" className="transition hover:text-foreground">Product</a>
          <a href="#use-cases" className="transition hover:text-foreground">Use cases</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
              Sign in
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="gap-1.5">
              Sign up
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 lg:pt-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Personalised music creation, powered by OG Bot
          </div>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Create personalised music with{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              OG Bot
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Turn real memories, names, places, family stories and life moments
            into lyrics, song briefs and Suno-ready prompts — all from one Music
            Hub.
          </p>

          <p className="mt-3 max-w-xl text-sm text-muted-foreground/80">
            Use OG Messenger for deeper creative help, and keep the floating OG
            Bot assistant with you anywhere inside the app.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="h-12 gap-2 px-6 text-sm font-medium">
                Start creating
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                size="lg"
                variant="outline"
                className="h-12 gap-2 px-6 text-sm font-medium"
              >
                <MessageSquareMore className="h-4 w-4" />
                Open OG Messenger
              </Button>
            </Link>
          </div>

          <ul className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-1">
            <HeroBullet>Lyrics shaped from your real story, not generic prompts</HeroBullet>
            <HeroBullet>Song briefs and prompts ready for Suno and beyond</HeroBullet>
            <HeroBullet>One workspace for drafts, versions and revisions</HeroBullet>
          </ul>
        </div>

        <ProductMockup />
      </div>
    </section>
  );
}

function HeroBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span>{children}</span>
    </li>
  );
}

function ProductMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-accent/10 blur-2xl" />

      <div className="relative rounded-2xl border border-border/60 bg-card/70 p-3 shadow-2xl backdrop-blur">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-2 pb-3 pt-1">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-3 text-[11px] text-muted-foreground">
            ogstudio.app / library
          </span>
        </div>

        <div className="grid gap-3 rounded-xl bg-background/60 p-3 sm:grid-cols-5">
          {/* Music Hub */}
          <div className="sm:col-span-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Music2 className="h-4 w-4 text-primary" />
                Music Hub
              </div>
              <span className="rounded-md border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                12 drafts
              </span>
            </div>

            <div className="mt-3 space-y-2">
              <SongRow title="For Mum — 60th birthday" mood="Soulful • Acoustic" progress={86} />
              <SongRow title="Liverpool nights" mood="Indie • Anthemic" progress={54} />
              <SongRow title="Letter to my younger self" mood="Cinematic • Ballad" progress={32} />
              <SongRow title="Wedding day — Sarah & Tom" mood="Pop • Warm" progress={70} />
            </div>
          </div>

          {/* OG Messenger */}
          <div className="rounded-lg border border-border/60 bg-card/60 p-3 sm:col-span-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquareMore className="h-4 w-4 text-accent" />
              OG Messenger
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <ChatBubble who="you">
                Help me write a tribute song for my grandad. He loved jazz.
              </ChatBubble>
              <ChatBubble who="bot">
                Got it. Tell me one memory of him that still makes you smile —
                we'll build the hook from there.
              </ChatBubble>
              <ChatBubble who="you">Sundays. Vinyl. Burnt toast.</ChatBubble>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              OG Bot is shaping a chorus…
            </div>
          </div>
        </div>
      </div>

      {/* Floating widget */}
      <div className="absolute -bottom-5 right-4 flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-3 py-2 shadow-xl backdrop-blur">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground">
          <Bot className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-medium">OG Bot</span>
        <span className="text-[10px] text-muted-foreground">always with you</span>
      </div>
    </div>
  );
}

function SongRow({
  title,
  mood,
  progress,
}: {
  title: string;
  mood: string;
  progress: number;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border/50 bg-card/60 p-2.5 transition hover:border-primary/40">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
        <PlayCircle className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{title}</p>
        <p className="truncate text-[10px] text-muted-foreground">{mood}</p>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  who,
  children,
}: {
  who: "you" | "bot";
  children: React.ReactNode;
}) {
  const mine = who === "you";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-2.5 py-1.5 leading-snug ${
          mine
            ? "bg-primary/90 text-primary-foreground"
            : "border border-border/60 bg-background/80 text-foreground"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: "Tell the story",
      body: "Start from a dedication, memory, relationship or simple idea. Names, places, inside jokes — bring the real stuff.",
    },
    {
      icon: <Wand2 className="h-5 w-5" />,
      title: "Shape the song",
      body: "OG Bot helps shape mood, tone, structure and lyrics. Push back, rewrite, refine — it's your song.",
    },
    {
      icon: <FileMusic className="h-5 w-5" />,
      title: "Generate the music brief",
      body: "Export a polished song brief and Suno-ready prompt. Take it to your favourite music engine and press play.",
    },
  ];

  return (
    <section id="how" className="border-t border-border/40 bg-card/20">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeader
          eyebrow="How it works"
          title="From a real memory to a finished song brief"
          body="Three calm steps. No blank-page panic."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="group relative rounded-xl border border-border/60 bg-card/60 p-6 transition hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                  {s.icon}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductSurfaces() {
  const cards = [
    {
      icon: <Music2 className="h-5 w-5" />,
      title: "Music Hub",
      body: "Create and manage song projects. Organise drafts, briefs and song workspaces in one calm place.",
      bullets: ["Project cards", "Draft versions", "Workspaces per song"],
    },
    {
      icon: <MessageSquareMore className="h-5 w-5" />,
      title: "OG Messenger",
      body: "Chat deeply with the assistant. Brainstorm lyrics, hooks, concepts and prompts in long-form.",
      bullets: ["Deep creative chats", "Lyric & hook ideation", "Prompt refinement"],
    },
    {
      icon: <Bot className="h-5 w-5" />,
      title: "Floating OG Bot",
      body: "Available across the app. Quick help while you're working anywhere — no context switching.",
      bullets: ["Anywhere in-app", "Compact or expanded", "Modes when you want them"],
    },
  ];

  return (
    <section id="product" className="border-t border-border/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeader
          eyebrow="Product surfaces"
          title="Three ways OG Bot shows up for you"
          body="One assistant, three surfaces — built for how musicians actually work."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-6 transition hover:border-primary/40"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition group-hover:opacity-100" />
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                {c.icon}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">
                {c.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {c.body}
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                {c.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [
    { icon: <Cake className="h-4 w-4" />, title: "Birthday songs", body: "Make someone's milestone unforgettable." },
    { icon: <Heart className="h-4 w-4" />, title: "Tribute & memorial songs", body: "Honour someone with their story in lyrics." },
    { icon: <Users className="h-4 w-4" />, title: "For parents or children", body: "Songs from one generation to another." },
    { icon: <Headphones className="h-4 w-4" />, title: "Love songs", body: "Real specifics beat generic romance — every time." },
    { icon: <Flame className="h-4 w-4" />, title: "Personal anthems", body: "A song that captures who you are right now." },
    { icon: <BookOpen className="h-4 w-4" />, title: "Story-driven songs", body: "Real life moments turned into music." },
  ];

  return (
    <section id="use-cases" className="border-t border-border/40 bg-card/20">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeader
          eyebrow="Use cases"
          title="Songs people actually want to make"
          body="OG Studio is built around real human moments — not generic prompt soup."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <div
              key={c.title}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-5 transition hover:border-primary/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                {c.icon}
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight">{c.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {c.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-border/40">
      <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 via-card/60 to-card/80 p-10 text-center shadow-xl backdrop-blur sm:p-14">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[140%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.25),transparent_70%)] blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Your next song is one story away
            </div>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
              Sign in and start creating personalised music
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
              Bring a name, a memory, a moment — OG Bot will help you turn it
              into a song brief you'll be proud to send to Suno.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-12 gap-2 px-6">
                  Continue with Google
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="h-12 gap-2 px-6">
                  Continue with Apple
                </Button>
              </Link>
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              No passwords. No spam. Cancel anytime.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground sm:text-base">{body}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Sparkles className="h-3 w-3" />
          </span>
          <span>© {new Date().getFullYear()} OG Studio. Music Hub powered by OG Bot.</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="#" className="transition hover:text-foreground">Privacy</a>
          <a href="#" className="transition hover:text-foreground">Terms</a>
          <Link to="/auth" className="transition hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
