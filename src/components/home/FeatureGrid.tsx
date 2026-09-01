import { Music2, Library, MessageCircle } from "lucide-react";
import { HubCard } from "./HubCard";
import { FlameHeading } from "@/components/ui/flame-heading";

const FEATURES = [
  {
    to: "/library",
    icon: <Library className="h-6 w-6" />,
    title: "MusicHUB",
    description: "All your tracks. Stream and review.",
    cta: "Open MusicHUB",
    primary: true,
  },
  {
    to: "/messenger",
    icon: <MessageCircle className="h-6 w-6" />,
    title: "OG Bot",
    description: "Ask OG Bot anything. 5 free coins on sign-up.",
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
          <FlameHeading as="h2" size="xl">What you can do</FlameHeading>
          <p className="text-sm text-muted-foreground">Everything you need to create and collect music.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <HubCard key={f.title} {...f} />
        ))}
      </div>
    </section>
  );
}
