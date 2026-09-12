import { createFileRoute } from "@tanstack/react-router";
import { rewritePlaylist, verifyStreamUrl } from "@/lib/tv-stream.server";

const UPSTREAM_HEADERS = {
  "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
  Accept: "*/*",
};

async function relay(request: Request) {
  const url = new URL(request.url);
  const upstream = verifyStreamUrl(url.searchParams);
  if (!upstream) return new Response("Invalid or expired stream link", { status: 403 });

  const headers = new Headers(UPSTREAM_HEADERS);
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);

  let response: Response;
  try {
    response = await fetch(upstream, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return new Response("Could not reach the stream", { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isPlaylist =
    /mpegurl|m3u/i.test(contentType) || /\.m3u8(\?|$)/i.test(new URL(upstream).pathname);

  const out = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });

  if (isPlaylist && response.ok) {
    const body = await response.text();
    const expires = Number(url.searchParams.get("e")) || Date.now();
    out.set("Content-Type", "application/vnd.apple.mpegurl");
    return new Response(rewritePlaylist(body, upstream, expires), { status: 200, headers: out });
  }

  for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  if (!out.has("content-type")) out.set("Content-Type", "video/mp2t");

  return new Response(response.body, { status: response.status, headers: out });
}

export const Route = createFileRoute("/api/public/tv/stream")({
  server: {
    handlers: {
      GET: ({ request }) => relay(request),
      HEAD: ({ request }) => relay(request),
    },
  },
});
