"use client";

import { useTransition, useState } from "react";
import { MapPin, Trash2, RefreshCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { saveMapping, deleteMapping, backfillCampaignOffers } from "./actions";
import type { OrphanCampaign, OfferOption, ActiveMapping } from "./actions";
import { PLATFORM_UTMIFY_CAMPAIGN } from "@/lib/offer-mappings-shared";

type Props = {
  orphans: OrphanCampaign[];
  offers: OfferOption[];
  activeMappings: ActiveMapping[];
};

function formatSpend(value: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return iso.substring(0, 10);
}

export function MappingsClient({ orphans, offers, activeMappings }: Props) {
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  function handleMap(campaignName: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErrors((prev) => ({ ...prev, [campaignName]: "" }));

    startTransition(async () => {
      try {
        await saveMapping(fd);
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [campaignName]: err instanceof Error ? err.message : "Erro ao salvar",
        }));
      }
    });
  }

  function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await deleteMapping(fd);
      } catch (err) {
        console.error("[mappings] delete:", err);
      }
    });
  }

  function handleBackfill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBackfillResult(null);
    setBackfillError(null);
    startTransition(async () => {
      try {
        const result = await backfillCampaignOffers();
        setBackfillResult(`${result.updated} snapshot(s) atualizados.`);
      } catch (err) {
        setBackfillError(err instanceof Error ? err.message : "Erro no reprocessamento.");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Instrução */}
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary shrink-0" />
            <CardTitle className="text-sm font-semibold">Como funciona</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cada campanha na UTMify tem um nome único. O cron de sync tenta resolver a oferta pelo
            nome — quando não consegue, classifica como <strong>Outros</strong>. Aqui você liga o
            nome exato da campanha a uma oferta. Na próxima execução do cron, novos dados chegam
            já classificados. Clique em <em>Reprocessar histórico</em> para corrigir os dados
            anteriores também.
          </p>
        </CardContent>
      </Card>

      {/* Campanhas órfãs */}
      <div>
        <h2 className="text-base font-semibold mb-1">
          Campanhas sem oferta ({orphans.length})
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Campanhas que aparecem como &quot;Outros&quot; nos relatórios. Selecione a oferta
          correspondente e clique em Mapear.
        </p>

        {orphans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma campanha órfã encontrada.
          </p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">Campanha</TableHead>
                  <TableHead className="w-[15%]">Gasto acum.</TableHead>
                  <TableHead className="w-[12%]">Último dado</TableHead>
                  <TableHead className="w-[28%]">Oferta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.map((o) => (
                  <TableRow key={o.campaignName}>
                    <TableCell className="font-mono text-xs break-all">
                      {o.campaignName}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatSpend(o.totalSpend)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(o.lastDate)}
                    </TableCell>
                    <TableCell>
                      <form
                        onSubmit={(e) => handleMap(o.campaignName, e)}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="externalId" value={o.campaignName} />
                        <input type="hidden" name="platform" value={PLATFORM_UTMIFY_CAMPAIGN} />
                        <Select name="offerId" required>
                          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                            <SelectValue placeholder="Selecionar oferta…" />
                          </SelectTrigger>
                          <SelectContent>
                            {offers.map((of) => (
                              <SelectItem key={of.id} value={String(of.id)}>
                                {of.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isPending}
                          className="shrink-0 h-7 text-xs px-2"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          Mapear
                        </Button>
                      </form>
                      {errors[o.campaignName] && (
                        <p className="text-xs text-destructive mt-1">
                          {errors[o.campaignName]}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Separator />

      {/* Mapeamentos ativos */}
      <div>
        <h2 className="text-base font-semibold mb-1">
          Mapeamentos ativos ({activeMappings.length})
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Campanhas já ligadas a uma oferta. Remover recria a lacuna — a campanha volta a aparecer
          como &quot;Outros&quot; até ser remapeada.
        </p>

        {activeMappings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum mapeamento cadastrado ainda.
          </p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Campanha</TableHead>
                  <TableHead className="w-[35%]">Oferta</TableHead>
                  <TableHead className="w-[15%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs break-all">
                      {m.externalId}
                    </TableCell>
                    <TableCell className="text-sm">{m.offerName}</TableCell>
                    <TableCell>
                      <form onSubmit={handleDelete}>
                        <input type="hidden" name="id" value={m.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          disabled={isPending}
                          aria-label="Remover mapeamento"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Separator />

      {/* Reprocessar histórico */}
      <div>
        <h2 className="text-base font-semibold mb-1">Reprocessar histórico</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Aplica todos os mapeamentos ativos nos snapshots antigos de{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">metrics_snapshots</code>.
          Use após cadastrar novos mapeamentos para corrigir dados passados.
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          A operação atualiza o campo <code>offerName</code> em cada snapshot cujo{" "}
          <code>campaignName</code> (normalizado) bate com um mapeamento. Pode levar alguns
          segundos dependendo do volume de dados.
        </p>

        <form onSubmit={handleBackfill} className="flex items-center gap-3">
          <Button type="submit" variant="outline" disabled={isPending}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            {isPending ? "Processando…" : "Reprocessar histórico"}
          </Button>
          {backfillResult && (
            <span className="text-sm text-emerald-600">{backfillResult}</span>
          )}
          {backfillError && (
            <span className="text-sm text-destructive">{backfillError}</span>
          )}
        </form>
      </div>
    </div>
  );
}
