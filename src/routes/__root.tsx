import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { ensureCurrentUserBootstrap } from "@/lib/user-bootstrap.functions";
import { useSiteContentRealtime } from "@/hooks/use-site-content";

function NotFoundComponent() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-gradient-brand">404</h1>
        <p className="mt-3 text-muted-foreground">This page doesn't exist.</p>
        <a
          href="/"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again or head home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PORTAL" },
      {
        name: "description",
        content: "Generate full songs from a prompt using AI. Powered by 0G-Streamz.",
      },
      { name: "author", content: "Sonix" },
      { property: "og:title", content: "PORTAL" },
      {
        property: "og:description",
        content: "Generate full songs from a prompt using AI. Powered by 0G-Streamz.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "PORTAL" },
      {
        name: "twitter:description",
        content: "Generate full songs from a prompt using AI. Powered by 0G-Streamz.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0962d120-9a6a-4403-b946-c07e83d9dfbd/id-preview-1984ac9d--07659a42-5b68-4c8b-83b5-ee9a625dbb92.lovable.app-1781064468022.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0962d120-9a6a-4403-b946-c07e83d9dfbd/id-preview-1984ac9d--07659a42-5b68-4c8b-83b5-ee9a625dbb92.lovable.app-1781064468022.png",
      },
      { name: "google-site-verification", content: "R34IxND5szTYrevWfX0gTnIvDi64kPx6wI0XCNM08YE" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Lilita+One&family=Nunito:wght@500;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const bootstrapUser = useServerFn(ensureCurrentUserBootstrap);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;
      try {
        const result = await bootstrapUser();
        if (result.ensuredBossRole || result.ensuredUserRole || result.ensuredProfile) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["user-role", data.user.id] }),
            queryClient.invalidateQueries({ queryKey: ["profile", data.user.id] }),
          ]);
          router.invalidate();
        }
      } catch (error) {
        console.error("user bootstrap failed", error);
      }
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, [bootstrapUser, queryClient, router]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RemoteAuthProvider>
          <SiteContentRealtimeBridge />
          <Outlet />
          <Toaster />
        </RemoteAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function SiteContentRealtimeBridge() {
  useSiteContentRealtime();
  return null;
}
