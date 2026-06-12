import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Compass, Globe2, Coins, Sparkles, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AdminEditablePortalField, useAdminEditMode } from "@/components/admin/AdminEditMode";
import { EditableContent } from "@/components/admin/EditableContent";
import { useRole } from "@/hooks/use-role";

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
  const { isAdmin } = useRole();
  const { enabled: editMode } = useAdminEditMode();
  const editingActive = isAdmin && editMode;

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

  // When edit mode is on, prevent the card-wide <Link> from swallowing clicks
  // on editable text. Otherwise keep cards fully clickable.
  const CardWrapper = ({ portal, children }: { portal: PortalRow; children: React.ReactNode }) =>
    editingActive ? (
      <div className="group flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
        {children}
        <Link
          to="/portal/$slug"
          params={{ slug: portal.slug }}
          className="mt-auto inline-flex items-center justify-end text-xs font-medium text-primary hover:underline"
        >
          Open portal →
        </Link>
      </div>
    ) : (
      <Link
        to="/portal/$slug"
        params={{ slug: portal.slug }}
        className="group flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-primary" />
            {portal.coin_cost_per_generation} coins / track
          </span>
          <span className="font-medium text-primary group-hover:underline">Open →</span>
        </div>
      </Link>
    );

  return (
    <DashboardShell title="Portals">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand-soft">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              <EditableContent contentKey="portals.heading" defaultValue="Explore portals" />
            </h2>
            <p className="text-sm text-muted-foreground">
              <EditableContent
                contentKey="portals.subtitle"
                defaultValue="Localized generators curated by the team. Pick one to start creating in its style."
                multiline
              />
            </p>
            {editingActive && (
              <p className="mt-1 text-xs text-primary">
                Edit mode is on — click any portal name, welcome text, or cost to edit.
              </p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => (
              <CardWrapper key={p.id} portal={p}>
                {(() => {
                  const isOgPortal = p.slug === "song-studio";
                  const displayName = isOgPortal ? "Song Studio" : p.name;

                  return (
                    <>
                      <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{
                      background: `linear-gradient(135deg, ${p.primary_color}, ${p.primary_color}99)`,
                    }}
                  >
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">
                        {isOgPortal ? (
                          displayName
                        ) : (
                          <AdminEditablePortalField portalId={p.id} field="name" value={p.name} />
                        )}
                      </h3>
                      {isOgPortal && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground shadow-glow ring-1 ring-primary/40">
                          <Bot className="h-2.5 w-2.5" /> OG Bot Engine
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe2 className="h-3 w-3" /> {p.language}
                    </p>
                  </div>
                </div>


                <div className="line-clamp-3 text-sm text-muted-foreground">
                  {isOgPortal ? (
                    <span>
                      The flagship OG Portal — describe your song idea, pick a style, and let
                      <span className="font-semibold text-primary"> OG Bot </span>
                      write the raw lyrics, compose the tracks, and manage your production workflow.
                    </span>
                  ) : (
                    <AdminEditablePortalField
                      portalId={p.id}
                      field="custom_welcome_text"
                      value={p.custom_welcome_text}
                      fallback={editingActive ? "Add a welcome message…" : ""}
                      multiline
                    />
                  )}
                </div>

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

                {editingActive && (
                  <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5 text-primary" />
                      <AdminEditablePortalField
                        portalId={p.id}
                        field="coin_cost_per_generation"
                        value={p.coin_cost_per_generation}
                        inputClassName="w-20"
                      />
                      <span>coins / track</span>
                    </span>
                  </div>
                )}
                    </>
                  );
                })()}
              </CardWrapper>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
            <Compass className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">
              <EditableContent
                contentKey="portals.empty"
                defaultValue="No portals yet. Check back soon — the boss is cooking new ones."
                multiline
              />
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
