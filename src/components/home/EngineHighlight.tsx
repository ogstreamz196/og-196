import { Link } from "@tanstack/react-router";
import { Bot, Play } from "lucide-react";

export function EngineHighlight() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-brand-soft p-10 shadow-glow md:p-14">
      <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            <Bot className="h-3.5 w-3.5" /> OG Bot Engine
          </div>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">The brain behind every beat</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            OG Bot doesn't just generate audio — it understands style, mood, and structure.
            Every track in your MusicHUB is shaped by AI that thinks like a producer.
          </p>
        </div>
        <Link
          to="/library"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          <Play className="h-4 w-4" /> Open MusicHUB
        </Link>
      </div>
    </section>
  );
}
