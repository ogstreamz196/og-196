import { Music2, Library, MessageCircle } from "lucide-react";
import { HubCard } from "./HubCard";

const FEATURES = [
  {
    to: "/library",
    icon: <Library className="h-6 w-6" />,
    title: "MusicHUB",
    description: "Every track you generate lives here. Stream, review, and build your personal catalog.",
    cta: "Open MusicHUB",
    primary: true,
  },
  {
    to: "/messenger",
    icon: <MessageCircle className="h-6 w-6" />,
    title: "OG Messenger",
    description: "Chat with OG Bot for tips, recommendations, and production advice. 5 free OG Coins on sign-up.",
    cta: "Chat",
  },
] as const;

export function FeatureGrid() {
  return (
    <section>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand-soft">
          <Music2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">What you can do</h2>
          <p className="text-sm text-muted-foreground">Everything you need to create and collect music.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <HubCard key={f.title} {...f} />
        ))}
      </div>
    </section>
  );
}
