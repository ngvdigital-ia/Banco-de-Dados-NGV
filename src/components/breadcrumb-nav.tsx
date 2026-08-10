"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mapa de segmentos URL → labels pt-BR.
 * Segmentos dinâmicos (ex: [id]) ficam sem mapa — exibem o valor bruto.
 */
const SEGMENT_LABELS: Record<string, string> = {
  // Raiz
  "": "Dashboard",
  // Seções principais
  operacao: "Operação",
  projects: "Projetos",
  offers: "Ofertas",
  agentes: "Agentes",
  triagem: "Triagem",
  team: "Equipe",
  metrics: "Métricas",
  analytics: "Análises",
  import: "Import CSV",
  settings: "Integrações",
  tags: "Tags",
  changelog: "Changelog",
  alerts: "Alertas",
  "ab-tests": "Testes A/B",
  // Sub-rotas de analytics
  creatives: "Criativos",
  compare: "Comparar",
  vsls: "VSLs",
  team_analytics: "Equipe",
  // Admin
  admin: "Admin",
};

function labelForSegment(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment;
}

/**
 * Constrói os crumbs a partir de pathname.
 * Ex: /analytics/creatives → [Dashboard, Análises, Criativos]
 */
function buildCrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: { label: string; href: string; isLast: boolean }[] = [
    { label: "Dashboard", href: "/", isLast: segments.length === 0 },
  ];

  segments.forEach((seg, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;
    crumbs.push({ label: labelForSegment(seg), href, isLast });
  });

  return crumbs;
}

export function BreadcrumbNav() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  // Página raiz: não exibe breadcrumb (seria só "Dashboard" isolado — ruído)
  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1 min-w-0">
          {i > 0 && (
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50"
              aria-hidden="true"
            />
          )}
          {crumb.isLast ? (
            <span
              className="text-sm font-medium text-foreground truncate"
              aria-current="page"
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className={cn(
                "text-sm text-muted-foreground truncate",
                "transition-colors duration-150",
                "hover:text-foreground"
              )}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
