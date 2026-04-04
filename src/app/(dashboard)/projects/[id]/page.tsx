import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProject } from "../actions";
import { VslsTab } from "./vsls-tab";
import { FunnelTab } from "./funnel-tab";
import { CreativesTab } from "./creatives-tab";
import { CampaignsTab } from "./campaigns-tab";

const statusLabels: Record<string, string> = {
  em_teste: "Em Teste",
  rodando: "Rodando",
  pausado: "Pausado",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(Number(id));

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/projects" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{project.niche}</span>
            <span>·</span>
            <span>{project.targetMarket}</span>
            <span>·</span>
            <span>{project.language}</span>
            <span>·</span>
            <Badge variant="outline">
              {statusLabels[project.status] ?? project.status}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="vsls">
        <TabsList>
          <TabsTrigger value="vsls">VSLs</TabsTrigger>
          <TabsTrigger value="funnel">Funil</TabsTrigger>
          <TabsTrigger value="creatives">Criativos</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
        </TabsList>
        <TabsContent value="vsls" className="mt-4">
          <VslsTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="funnel" className="mt-4">
          <FunnelTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="creatives" className="mt-4">
          <CreativesTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-4">
          <CampaignsTab projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
