"use client";

import {
  BarChart3,
  ClipboardList,
  FolderOpen,
  History,
  LayoutDashboard,
  LineChart,
  PieChart,
  Settings,
  Tags,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
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

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Projetos", href: "/projects", icon: FolderOpen },
  { title: "Ofertas", href: "/offers", icon: ClipboardList },
  { title: "Equipe", href: "/team", icon: Users },
  { title: "Métricas", href: "/metrics", icon: LineChart },
  { title: "Análises", href: "/analytics", icon: PieChart },
  { title: "Import CSV", href: "/import", icon: Upload },
  { title: "Integrações", href: "/settings", icon: Settings },
  { title: "Tags", href: "/tags", icon: Tags },
  { title: "Changelog", href: "/changelog", icon: History },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          <span className="text-lg font-bold">NGV Digital</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3">
          <UserButton />
          <span className="text-sm text-muted-foreground">Minha conta</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
