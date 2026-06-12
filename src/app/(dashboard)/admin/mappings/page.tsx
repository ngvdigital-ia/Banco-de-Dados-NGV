import { redirect } from "next/navigation";
import { getCurrentUser, isAdminEmail } from "@/lib/admin-auth";
import { PageHeader } from "@/components/ui/page-header";
import { getOrphanCampaigns, getOffersForMapping, getActiveMappings } from "./actions";
import { MappingsClient } from "./mappings-client";

export const dynamic = "force-dynamic";

export default async function MappingsPage() {
  const me = await getCurrentUser();
  if (!me?.email) redirect("/sign-in");
  if (!isAdminEmail(me.email)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas administradores podem acessar a Central de Mapeamento.
        </p>
      </div>
    );
  }

  const [orphans, offers, activeMappings] = await Promise.all([
    getOrphanCampaigns(),
    getOffersForMapping(),
    getActiveMappings(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <PageHeader
        title="Central de Mapeamento"
        description="Liga campanhas externas (UTMify) às ofertas do dashboard. Resolve o 'Outros' nos relatórios por oferta."
      />

      <MappingsClient
        orphans={orphans}
        offers={offers}
        activeMappings={activeMappings}
      />
    </div>
  );
}
