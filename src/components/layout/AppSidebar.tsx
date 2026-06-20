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
} from "lucide-react";
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
} from "@/components/ui/sidebar";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";

type NavItem = { title: string; url: string; icon: typeof Home };

const primaryNav: NavItem[] = [
  { title: "Home", url: "/", icon: Home },
  { title: "Music Hub", url: "/library", icon: Music2 },
  { title: "Messenger", url: "/messenger", icon: MessagesSquare },
  { title: "Portals", url: "/portals", icon: DoorOpen },
];

const accountNav: NavItem[] = [
  { title: "Buy Coins", url: "/buy-coins", icon: Coins },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Developer", url: "/developer", icon: Code2 },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { isAdmin } = useRole();

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
          <Link to={item.url} className="flex items-center gap-2">
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground font-black">
            OG
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">PORTAL</span>
            <span className="truncate text-xs text-muted-foreground">by OG Streamz</span>
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
                    <Link to="/admin" className="flex items-center gap-2">
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
    </Sidebar>
  );
}
