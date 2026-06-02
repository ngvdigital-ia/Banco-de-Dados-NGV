"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { statusOferta, labelOf } from "@/lib/status-labels";

const formatLabels: Record<string, string> = {
  especialista: "Especialista",
  ugc_masc: "UGC Masc",
  ugc_fem: "UGC Fem",
  famoso: "Famoso",
  youtuber: "YouTuber",
  autoridade: "Autoridade",
  podcast: "Podcast",
};

const AD_FORMAT_OPTIONS = [
  { value: "especialista", label: "Especialista" },
  { value: "ugc_masc", label: "UGC Masc" },
  { value: "ugc_fem", label: "UGC Fem" },
  { value: "famoso", label: "Famoso" },
  { value: "youtuber", label: "YouTuber" },
  { value: "autoridade", label: "Autoridade" },
  { value: "podcast", label: "Podcast" },
];

type OfferRow = {
  format: string;
  platform: string | null;
  language: string;
  adsEdited: number | null;
  validation: string | null;
  scale: string | null;
  copyVsl: string | null;
};

type CampaignData = {
  activeCampaigns: number;
  totalSpend: number;
  totalRevenue: number;
  roas: number | null;
  currency: string;
};

type AdData = {
  adNumber: string;
  spend: number;
  revenue: number;
  profit: number;
  roas: number | null;
  editors: string;
  variantCount: number;
  adFormat: string | null;
};

function formatCurrency(value: number, currency: string) {
  if (!value) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function CreativesTable({
  offers,
  campaignMap,
  adsMap,
  hasCampaignData,
}: {
  offers: OfferRow[];
  campaignMap: Record<string, CampaignData>;
  adsMap: Record<string, AdData[]>;
  hasCampaignData: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(offerName: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(offerName)) next.delete(offerName);
      else next.add(offerName);
      return next;
    });
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Oferta</TableHead>
            <TableHead>Idioma</TableHead>
            <TableHead>Copy VSL</TableHead>
            <TableHead className="text-right">Ads Editados</TableHead>
            <TableHead>Validação</TableHead>
            <TableHead>Escala</TableHead>
            {hasCampaignData && (
              <>
                <TableHead className="text-right">Campanhas</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
                <TableHead className="text-right">Ads UTM</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((row, i) => {
            const isEscalou = row.validation === "SIM" && (row.scale === "SIM" || row.scale === "EM ANDAMENTO");
            const isNaoEscalou = row.scale === "NAO" || row.scale === "NÃO" || row.validation === "NÃO DEU CERTO";
            const campaign = campaignMap[row.format];
            const ads = adsMap[row.format];
            const hasAds = ads && ads.length > 0;
            const isExpanded = expanded.has(row.format);

            return (
              <>
                <TableRow
                  key={`offer-${i}`}
                  className={hasAds ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={() => hasAds && toggleExpand(row.format)}
                >
                  <TableCell className="w-8 px-2">
                    {hasAds ? (
                      isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )
                    ) : null}
                  </TableCell>
                  <TableCell className="font-medium">{row.format}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.language}</Badge>
                  </TableCell>
                  <TableCell>{row.copyVsl ?? "-"}</TableCell>
                  <TableCell className="tabular-nums text-right">{row.adsEdited ?? 0}</TableCell>
                  <TableCell>
                    <Badge
                      variant={row.validation === "SIM" ? "default" : "outline"}
                      className={
                        row.validation === "SIM" ? "bg-success text-success-foreground" :
                        row.validation === "EM ANDAMENTO" ? "border-warning text-warning" :
                        row.validation === "NÃO DEU CERTO" ? "border-danger text-danger" :
                        ""
                      }
                    >
                      {labelOf(statusOferta, row.validation)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isEscalou ? (
                      <Badge className="bg-success text-success-foreground">Escalou</Badge>
                    ) : isNaoEscalou ? (
                      <Badge variant="outline" className="border-danger text-danger">Não Escalou</Badge>
                    ) : (
                      <Badge variant="outline" className="border-warning text-warning">{labelOf(statusOferta, row.scale) ?? "Em andamento"}</Badge>
                    )}
                  </TableCell>
                  {hasCampaignData && (
                    <>
                      <TableCell className="text-right">{campaign?.activeCampaigns ?? "-"}</TableCell>
                      <TableCell className="tabular-nums text-right text-danger">
                        {campaign ? formatCurrency(campaign.totalSpend, campaign.currency) : "-"}
                      </TableCell>
                      <TableCell className="tabular-nums text-right text-success">
                        {campaign ? formatCurrency(campaign.totalRevenue, campaign.currency) : "-"}
                      </TableCell>
                      <TableCell className="tabular-nums text-right">
                        {campaign?.roas != null ? `${campaign.roas}x` : "-"}
                      </TableCell>
                      <TableCell className="tabular-nums text-right">{hasAds ? ads.length : "-"}</TableCell>
                    </>
                  )}
                </TableRow>
                {/* Expanded ad rows */}
                {isExpanded && ads && ads.map((ad, j) => (
                  <TableRow key={`ad-${i}-${j}`} className="bg-muted/30">
                    <TableCell></TableCell>
                    <TableCell colSpan={2} className="pl-8">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-xs">{ad.adNumber}</Badge>
                        <span className="text-xs text-muted-foreground">{ad.editors}</span>
                        <span className="text-xs text-muted-foreground">({ad.variantCount} var.)</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select defaultValue={ad.adFormat ?? undefined}>
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue placeholder="Formato" />
                        </SelectTrigger>
                        <SelectContent>
                          {AD_FORMAT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    {hasCampaignData && (
                      <>
                        <TableCell></TableCell>
                        <TableCell className="tabular-nums text-right text-danger text-sm">
                          {formatCurrency(ad.spend, campaign?.currency ?? "USD")}
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-success text-sm">
                          {formatCurrency(ad.revenue, campaign?.currency ?? "USD")}
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-sm">
                          {ad.roas != null ? `${ad.roas}x` : "-"}
                        </TableCell>
                        <TableCell></TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
