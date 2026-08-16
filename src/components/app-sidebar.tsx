"use client";

import {
  BarChart3,
  BellRing,
  Bot,
  ClipboardList,
  Database,
  FolderOpen,
  GraduationCap,
  History,
  LayoutDashboard,
  LineChart,
  PieChart,
  RadioTower,
  Rocket,
  ScanSearch,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { isAdminEmail } from "@/lib/admin-emails";
import { isOperationCockpitEnabled } from "@/lib/operacao/feature";
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

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projetos", href: "/projects", icon: FolderOpen },
  { title: "Ofertas", href: "/offers", icon: ClipboardList },
  { title: "Agentes", href: "/agentes", icon: Bot },
  { title: "Equipe", href: "/team", icon: Users },
  { title: "Métricas", href: "/metrics", icon: LineChart },
  { title: "Análises", href: "/analytics", icon: PieChart },
  { title: "Vendas", href: "/vendas", icon: ShoppingCart },
  { title: "Alertas", href: "/alertas", icon: BellRing },
  { title: "Import CSV", href: "/import", icon: Upload },
  { title: "Integrações", href: "/settings", icon: Settings },
  { title: "Tags", href: "/tags", icon: Tags },
  { title: "Changelog", href: "/changelog", icon: History },
];

const systemNavItems: NavItem[] = [
  { title: "Visão geral", href: "/operacao", icon: RadioTower },
  { title: "Banco NGV", href: "/sistemas/banco-ngv", icon: Database },
  { title: "Apps Ofertas", href: "/sistemas/apps-ofertas", icon: Rocket },
  { title: "Cursos", href: "/sistemas/cursos", icon: GraduationCap },
  { title: "Spy Analytics", href: "/sistemas/spy", icon: ScanSearch },
  { title: "Quiz Analytics", href: "/sistemas/quiz", icon: BarChart3 },
  { title: "Nexfy", href: "/sistemas/nexfy", icon: PieChart },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const isAdmin = isAdminEmail(user?.primaryEmailAddress?.emailAddress);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
          <span className="text-base font-semibold tracking-tight">NGV Digital</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 px-2">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                    className="group/item h-11 rounded-md px-3 transition-all duration-150 ease-in-out md:h-9"
                  >
                    <item.icon className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover/item:scale-110" />
                    <span className="text-sm">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isOperationCockpitEnabled && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Sistemas
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-2">
                {systemNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href}
                      className="group/item h-9 rounded-md px-3 transition-all duration-150 ease-in-out"
                    >
                      <item.icon className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover/item:scale-110" />
                      <span className="text-sm">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {isAdmin && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-2">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/admin/team" />}
                    isActive={pathname.startsWith("/admin/team")}
                    className="group/item h-9 rounded-md px-3 transition-all duration-150 ease-in-out"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover/item:scale-110" />
                    <span className="text-sm">Equipe & Acessos</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-md px-1 py-1">
          <UserButton />
          <span className="text-sm text-muted-foreground">Minha conta</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
