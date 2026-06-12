import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CommandPalette, CommandPaletteTrigger } from "@/components/command-palette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        {/* Topbar: altura consistente h-12, borda sutil, indigo-tinted no dark */}
        <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
          <SidebarTrigger className="shrink-0 text-muted-foreground transition-colors duration-150 hover:text-foreground" />
          {/* Divisor visual sutil entre trigger e breadcrumb */}
          <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
          <BreadcrumbNav />
          <div className="ml-auto">
            <CommandPaletteTrigger />
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
      <CommandPalette />
    </SidebarProvider>
  );
}
