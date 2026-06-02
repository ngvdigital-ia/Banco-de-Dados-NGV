import { Video, Megaphone, Users, Trophy, ArrowLeftRight } from "lucide-react";
import { NavCard } from "@/components/ui/nav-card";
import { PageHeader } from "@/components/ui/page-header";

const sections = [
  {
    title: "Performance de VSLs",
    description: "Métricas VTurb ao vivo por oferta — views, plays, play rate e retenção ao pitch.",
    href: "/analytics/vsls",
    icon: Video,
  },
  {
    title: "Performance de Criativos",
    description: "Quais formatos de criativo estão sendo mais usados e em quais plataformas.",
    href: "/analytics/creatives",
    icon: Megaphone,
  },
  {
    title: "Performance de Editores",
    description: "Ranking de produtividade dos editores: quem produziu mais criativos.",
    href: "/analytics/team",
    icon: Users,
  },
  {
    title: "Ranking de Ofertas",
    description: "Quantas ofertas lançaram, quais validaram, quais estão escalando.",
    href: "/analytics/offers",
    icon: Trophy,
  },
  {
    title: "Comparar",
    description: "Compare métricas entre nichos, idiomas, copywriters ou editores lado a lado.",
    href: "/analytics/compare",
    icon: ArrowLeftRight,
  },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Análises"
        description="Insights sobre VSLs, criativos, equipe e ofertas."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {sections.map((section) => (
          <NavCard
            key={section.href}
            href={section.href}
            icon={section.icon}
            title={section.title}
            description={section.description}
          />
        ))}
      </div>
    </div>
  );
}
