import { createFileRoute, Link } from "@tanstack/react-router";
import { Headphones, Home } from "lucide-react";
import ogBotAsset from "@/assets/ogbot.png.asset.json";
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
  const lyrics = track?.lyrics?.trim();

  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground sm:py-14">
      <section className="mx-auto w-full max-w-2xl text-center">
        <img
          src={ogBotAsset.url}
          alt="OG BOT"
          width={512}
          height={512}
          className="mx-auto aspect-square w-52 rounded-2xl object-cover shadow-glow sm:w-64"
        />

        {track ? (
          <>
            <h1 className="mt-8 text-balance font-display text-3xl text-foreground sm:text-4xl">
              {track.title}
            </h1>
            <audio
              className="mx-auto mt-7 w-full max-w-xl accent-primary"
              controls
              controlsList="nodownload"
              preload="metadata"
              src={track.audioUrl}
            >
              Your browser does not support audio playback.
            </audio>
            <Button asChild size="lg" className="mt-7 w-full max-w-xl">
              <Link to="/welcome">
                <Headphones className="h-5 w-5" /> Make a track with OG BOT
              </Link>
            </Button>

            {lyrics && (
              <section className="mx-auto mt-12 max-w-xl border-t border-border pt-9 text-left">
                <h2 className="font-display text-2xl text-foreground">Lyrics</h2>
                <div className="mt-5 whitespace-pre-wrap text-pretty text-base leading-8 text-muted-foreground">
                  {lyrics}
                </div>
              </section>
            )}
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