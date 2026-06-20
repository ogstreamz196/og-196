import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-md sm:px-4">
            <SidebarTrigger className="shrink-0" />
            <div className="min-w-0 flex-1" />
          </header>

          <main className="flex-1 min-w-0">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>

          {/* Floating OG Bot widget mount point */}
          <div id="og-widget-root" className="pointer-events-none fixed inset-0 z-40" aria-hidden />
        </div>
      </div>
    </SidebarProvider>
  );
}
