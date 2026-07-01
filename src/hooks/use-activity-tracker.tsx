import { useEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// Human-readable label for a pathname. Keep in sync with the app's nav.
export function labelForPath(pathname: string): string {
  if (!pathname || pathname === "/") return "Home";
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/messenger": "OG Bot Messenger",
    "/library": "Library",
    "/library/index": "Library",
    "/musichub": "MusicHUB",
    "/welcome": "Welcome",
    "/buy-coins": "Buy Coins",
    "/buy-coins/return": "Purchase Complete",
    "/referrals": "Earnings",
    "/settings": "Settings",
    "/auth": "Sign In",
    "/admin": "Admin Dashboard",
    "/admin/users": "Admin — Users",
    "/admin/onboarding": "Admin — Onboarding",
    "/admin/telegram": "Admin — Telegram",
    "/admin/stripe": "Admin — Stripe",
    "/admin/pricing": "Admin — Pricing",
  };
  if (map[pathname]) return map[pathname];
  // /library/<songId>
  if (pathname.startsWith("/library/")) return "Library — Song";
  if (pathname.startsWith("/admin/")) return `Admin — ${pathname.slice(7).replace(/[-/]/g, " ")}`;
  // Fallback: last segment, humanized
  const last = pathname.split("/").filter(Boolean).pop() ?? "Page";
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Logs every route change + a 30s heartbeat while the tab is visible so Boss
 * can see who's online and what page/menu they last opened.
 */
export function ActivityTracker() {
  const { user } = useAuth();
  const router = useRouter();
  const routerState = useRouterState({ select: (s) => s.location.pathname });
  const lastPath = useRef<string | null>(null);
  const lastLog = useRef<number>(0);

  // Log path changes
  useEffect(() => {
    if (!user?.id) return;
    const pathname = routerState;
    if (!pathname) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    lastLog.current = Date.now();
    void supabase.rpc("log_user_activity", {
      p_action: "nav",
      p_path: pathname,
      p_label: labelForPath(pathname),
      p_metadata: null,
    });
  }, [user?.id, routerState]);

  // Heartbeat every 30s while visible
  useEffect(() => {
    if (!user?.id) return;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      if (document.visibilityState !== "visible") return;
      // Throttle: don't hit within 20s of a nav write
      if (Date.now() - lastLog.current < 20_000) return;
      lastLog.current = Date.now();
      const path = router.state.location.pathname;
      void supabase.rpc("log_user_activity", {
        p_action: "heartbeat",
        p_path: path,
        p_label: labelForPath(path),
        p_metadata: null,
      });
    };

    // First tick shortly after mount
    const initial = setTimeout(tick, 2000);
    const iv = setInterval(tick, 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearTimeout(initial);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id, router]);

  // Delegate: any element with data-nav-label OR data-menu-item logs on click
  useEffect(() => {
    if (!user?.id) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-nav-label], [data-menu-item]",
      );
      if (!el) return;
      const label =
        el.getAttribute("data-nav-label") ??
        el.getAttribute("data-menu-item") ??
        el.textContent?.trim().slice(0, 80) ??
        "menu item";
      lastLog.current = Date.now();
      void supabase.rpc("log_user_activity", {
        p_action: "menu_click",
        p_path: router.state.location.pathname,
        p_label: label,
        p_metadata: null,
      });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as never);
  }, [user?.id, router]);

  return null;
}
