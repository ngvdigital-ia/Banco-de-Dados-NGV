import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Video, Megaphone, Users, Trophy } from "lucide-react";

const sections = [
  {
    title: "Comparação de VSLs",
    description: "Compare versões de VSL lado a lado para ver qual performa melhor.",
    href: "/analytics/vsls",
    icon: Video,
  },
  {
    title: "Análise de Criativos",
    description: "Quais formatos de criativo estão sendo mais usados e em quais plataformas.",
    href: "/analytics/creatives",
    icon: Megaphone,
  },
  {
    title: "Performance da Equipe",
    description: "Ranking de produtividade: quem produziu mais VSLs, criativos e campanhas.",
    href: "/analytics/team",
    icon: Users,
  },
  {
    title: "Ranking de Ofertas",
    description: "Quantas ofertas lançaram, quais validaram, quais estão escalando.",
    href: "/analytics/offers",
    icon: Trophy,
  },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Análises</h1>
      <p className="text-muted-foreground">
        Insights sobre VSLs, criativos, equipe e ofertas.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.href} className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3">
              <section.icon className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <p className="text-sm text-muted-foreground">{section.description}</p>
              <Button variant="ghost" size="sm" render={<Link href={section.href} />}>
                Ver <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
