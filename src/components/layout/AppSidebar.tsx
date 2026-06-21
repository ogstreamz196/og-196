import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Music2,
  MessagesSquare,
  DoorOpen,
  Coins,
  Settings,
  Code2,
  Shield,
  LogOut,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import ogStreamzLogo from "@/assets/ogstreamz-logo.jpg.asset.json";
import ogBotAsset from "@/assets/ogbot.png.asset.json";

type AppRoute = "/" | "/library" | "/messenger" | "/portals" | "/buy-coins" | "/settings" | "/developer" | "/admin";
type NavItem = { title: string; url: AppRoute; icon: typeof Home; adminOnly?: boolean };

const primaryNav: NavItem[] = [
  { title: "Home", url: "/", icon: Home },
  { title: "Music Hub", url: "/library", icon: Music2 },
  { title: "OG Messenger", url: "/messenger", icon: MessagesSquare },
  { title: "Portals", url: "/portals", icon: DoorOpen, adminOnly: true },
];

const accountNav: NavItem[] = [
  { title: "Store", url: "/buy-coins", icon: Coins },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Developer", url: "/developer", icon: Code2, adminOnly: true },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const qc = useQueryClient();

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    window.location.replace("/auth");
  };

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  const visible = (items: NavItem[]) => items.filter((i) => !i.adminOnly || isAdmin);

  const renderItems = (items: NavItem[]) =>
    visible(items).map((item) => {
      const active = isActive(item.url);
      const isMessenger = item.url === "/messenger";
      return (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton
            asChild
            isActive={active}
            tooltip={item.title}
            className={`font-display text-[15px] tracking-tight transition-all duration-200 hover:translate-x-0.5 hover:scale-[1.02] ${
              active
                ? "bg-gradient-brand text-primary-foreground shadow-glow hover:bg-gradient-brand"
                : ""
            } ${isMessenger ? "hover:text-primary" : ""}`}
          >
            <Link to={item.url} onClick={() => isMobile && setOpenMobile(false)} className="flex items-center gap-2">
              <item.icon className={`h-4 w-4 shrink-0 ${isMessenger && !active ? "text-primary" : ""}`} />
              <span className="truncate">{item.title}</span>
              {isMessenger && (
                <span className="ml-auto rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  Bot
                </span>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2.5">
          <img
            src={ogStreamzLogo.url}
            alt="OG Streamz"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-white/10 shadow-glow pointer-events-none select-none"
          />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="font-display truncate text-base tracking-tight">OG STREAMZ</span>
            <span className="mt-0.5 inline-flex items-center gap-1 truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Powered by
              <img
                src={ogBotAsset.url}
                alt="OG Bot"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="h-3.5 w-3.5 rounded-full object-cover pointer-events-none select-none"
              />
              <span className="font-bold tracking-wider text-foreground/80">OG Bot</span>
            </span>
          </div>
        </div>
      </SidebarHeader>



      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(primaryNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(accountNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip="Admin">
                    <Link to="/admin" onClick={() => isMobile && setOpenMobile(false)} className="flex items-center gap-2">
                      <Shield className="h-4 w-4 shrink-0" />
                      <span className="truncate">Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex min-w-0 items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold uppercase">
            {user?.email?.[0] ?? "U"}
          </div>
          <span className="truncate">{user?.email ?? "Signed in"}</span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
