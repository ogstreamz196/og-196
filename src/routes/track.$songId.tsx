import { createFileRoute, Link } from "@tanstack/react-router";
import { Headphones, Home, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicSharedTrack } from "@/lib/public-track.functions";

const SITE_URL = "https://og-196.lovable.app";
const SHARE_IMAGE = `${SITE_URL}/share/og-bot-track.png`;

export const Route = createFileRoute("/track/$songId")({
  loader: ({ params }) => getPublicSharedTrack({ data: { songId: params.songId } }),
  head: ({ params, loaderData }) => {
    const title = loaderData?.title || "Shared OG BOT track";
    const description = loaderData
      ? `Listen to “${title}”, created with OG BOT.`
      : "Listen to music created with OG BOT.";
    const url = `${SITE_URL}/track/${params.songId}`;
    return {
      meta: [
        { title: `${title} — OG BOT` },
        { name: "description", content: description },
        { property: "og:title", content: `${title} — OG BOT` },
        { property: "og:description", content: description },
        { property: "og:type", content: "music.song" },
        { property: "og:url", content: url },
        { property: "og:image", content: SHARE_IMAGE },
        { property: "og:image:alt", content: "OG BOT" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${title} — OG BOT` },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: SHARE_IMAGE },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: SharedTrackPage,
});

function SharedTrackPage() {
  const track = Route.useLoaderData();

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-lg text-center">
        <img
          src="/share/og-bot-track.png"
          alt="OG BOT"
          width={1200}
          height={630}
          className="mx-auto aspect-[1200/630] w-44 rounded-lg object-cover shadow-glow"
        />

        {track ? (
          <>
            <div className="mx-auto mt-8 aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {track.coverUrl ? (
                <img src={track.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center bg-gradient-brand-soft">
                  <Music2 className="h-20 w-20 text-primary" />
                </div>
              )}
            </div>
            <h1 className="mt-7 font-display text-3xl text-foreground">{track.title}</h1>
            {track.style && <p className="mt-2 text-sm text-muted-foreground">{track.style}</p>}
            <audio className="mt-6 w-full" controls preload="metadata" src={track.audioUrl}>
              Your browser does not support audio playback.
            </audio>
            <Button asChild size="lg" className="mt-7 w-full">
              <Link to="/welcome">
                <Headphones className="h-5 w-5" /> Make a track with OG BOT
              </Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-8 font-display text-3xl text-foreground">Track unavailable</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              This track is private, was removed, or is no longer available.
            </p>
            <Button asChild variant="outline" className="mt-7">
              <Link to="/welcome">
                <Home className="h-4 w-4" /> Visit OG BOT
              </Link>
            </Button>
          </>
        )}
      </section>
    </main>
  );
}