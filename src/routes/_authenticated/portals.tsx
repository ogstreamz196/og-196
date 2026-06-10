import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Compass, Globe2, Coins, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const Route = createFileRoute("/_authenticated/portals")({
  component: PortalsPage,
});

interface PortalRow {
  id: string;
  slug: string;
  name: string;
  language: string;
  status: string;
  style_tags: string[] | null;
  primary_color: string;
  coin_cost_per_generation: number;
  custom_welcome_text: string | null;
}

function PortalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["portals", "active"],
    queryFn: async (): Promise<PortalRow[]> => {
      const { data, error } = await supabase
        .from("portals")
        .select(
          "id, slug, name, language, status, style_tags, primary_color, coin_cost_per_generation, custom_welcome_text",
        )
        .eq("status", "active")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PortalRow[];
    },
  });

  return (
    <DashboardShell title="Portals">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand-soft">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Explore portals</h2>
            <p className="text-sm text-muted-foreground">
              Localized generators curated by the team. Pick one to start creating in its style.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => (
              <Link
                key={p.id}
                to="/portal/$slug"
                params={{ slug: p.slug }}
                className="group flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{
                      background: `linear-gradient(135deg, ${p.primary_color}, ${p.primary_color}99)`,
                    }}
                  >
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{p.name}</h3>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe2 className="h-3 w-3" /> {p.language}
                    </p>
                  </div>
                </div>

                {p.custom_welcome_text && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {p.custom_welcome_text}
                  </p>
                )}

                {p.style_tags && p.style_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.style_tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Coins className="h-3.5 w-3.5 text-primary" />
                    {p.coin_cost_per_generation} coins / track
                  </span>
                  <span className="font-medium text-primary group-hover:underline">
                    Open →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
            <Compass className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">
              No portals yet. Check back soon — the boss is cooking new ones.
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
