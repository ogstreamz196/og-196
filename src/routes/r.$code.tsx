import { createFileRoute, Navigate } from "@tanstack/react-router";
import ogbot from "@/assets/ogbot.png.asset.json";

const OG_IMAGE = `https://ogstreamz.co.uk${ogbot.url}`;
const TITLE = "Join me on OG Streamz — make AI songs";
const DESC =
  "Sign up with my link and we both win — turn prompts into full songs with cover art.";

export const Route = createFileRoute("/r/$code")({
  head: ({ params }) => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `https://ogstreamz.co.uk/r/${params.code}` },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: "OG Streamz bot" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `https://ogstreamz.co.uk/r/${params.code}` }],
  }),
  component: ReferralRedirect,
});

function ReferralRedirect() {
  const { code } = Route.useParams();
  return <Navigate to="/welcome" search={{ ref: code } as never} replace />;
}
