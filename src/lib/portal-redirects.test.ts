import { describe, it, expect } from "vitest";
import { Route as PortalsRoute } from "@/routes/_authenticated/portals";
import { Route as PortalSlugRoute } from "@/routes/portal.$slug";

/**
 * Both legacy portal routes must redirect to /library (MusicHUB) instead
 * of 404-ing. We assert the route's beforeLoad throws a redirect descriptor
 * whose `to` is /library.
 */
function captureRedirect(beforeLoad: (ctx: any) => unknown, ctx: any = {}) {
  try {
    beforeLoad(ctx);
  } catch (thrown) {
    return thrown as { options?: { to?: string; href?: string } };
  }
  throw new Error("beforeLoad did not throw a redirect");
}

describe("legacy portal routes redirect to MusicHUB", () => {
  it("/portals redirects to /library", () => {
    const r = captureRedirect(PortalsRoute.options.beforeLoad!);
    expect(r?.options?.to ?? r?.options?.href).toBe("/library");
  });

  it("/portal/$slug redirects to /library for any slug", () => {
    for (const slug of ["alpha", "beta-portal", "123"]) {
      const r = captureRedirect(PortalSlugRoute.options.beforeLoad!, {
        params: { slug },
      });
      expect(r?.options?.to ?? r?.options?.href).toBe("/library");
    }
  });
});
