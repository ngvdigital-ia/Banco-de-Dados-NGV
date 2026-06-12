"use client";

import { ExternalLink } from "lucide-react";
import { type SiteUrls, primaryUrl, totalLinks } from "@/lib/site-urls-types";

// ---------- Tipo local (espelho do Offer em offer-table.tsx — não edita o original) ----------

type Offer = {
  id: number;
  name: string;
  copyVsl: string | null;
  copyAds: string | null;
  editorAds: string | null;
  editorVsl: string | null;
  ticket: string | null;
  language: string;
  gender: string | null;
  copyVslStatus: string | null;
  copyCriativosStatus: string | null;
  vslInVturb: string | null;
  adsCopyByPerson: unknown;
  adsEditedCount: number | null;
  adsEditedByPerson: unknown;
  adsRejectedCount: number | null;
  editorStatus: unknown;
  campaignsActive: string | null;
  validation: string | null;
  preScale: string | null;
  scale: string | null;
  productCreated: string | null;
  productApproved: string | null;
  siteCreated: string | null;
  siteUrl: string | null;
  siteUrls: unknown;
  adFormat: string | null;
  observations: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ---------- Helpers de status ----------

const statusColors: Record<string, string> = {
  SIM: "bg-success-muted text-success-muted-foreground border-success",
  NAO: "bg-danger-muted text-danger-muted-foreground border-danger",
  "EM ANDAMENTO": "bg-warning-muted text-warning-muted-foreground border-warning",
  "NÃO DEU CERTO": "bg-muted text-muted-foreground border-border line-through",
};

function getStatusColor(val: string | null): string {
  const upper = (val || "NAO").toUpperCase().trim();
  return statusColors[upper] ?? statusColors["NAO"];
}

function statusLabel(val: string | null): string {
  const upper = (val || "NAO").toUpperCase().trim();
  if (upper === "NÃO DEU CERTO") return "N/CERTO";
  if (upper === "EM ANDAMENTO") return "ANDAMENTO";
  return upper;
}

// ---------- Progresso (mesma lógica de calcProgress em offer-table) ----------

const PROGRESS_FIELDS = [
  "copyVslStatus",
  "copyCriativosStatus",
  "vslInVturb",
  "productCreated",
  "productApproved",
  "siteCreated",
  "validation",
  "scale",
] as const;

function calcProgress(offer: Offer): number {
  return PROGRESS_FIELDS.filter((f) => {
    const val = ((offer[f] as string | null) || "").toUpperCase().trim();
    return val === "SIM";
  }).length;
}

// ---------- Sub-componentes de card ----------

function StatusChip({ value, label }: { value: string | null; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${getStatusColor(value)}`}
      >
        {statusLabel(value)}
      </span>
    </div>
  );
}

function MiniProgressBar({ offer }: { offer: Offer }) {
  const count = calcProgress(offer);
  const pct = Math.round((count / 8) * 100);
  const color =
    pct >= 75
      ? "bg-success"
      : pct >= 50
        ? "bg-warning"
        : pct >= 25
          ? "bg-warning"
          : "bg-danger";

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono font-medium tabular-nums text-muted-foreground">
        {count}/8
      </span>
    </div>
  );
}

function LanguageBadge({ language }: { language: string }) {
  return (
    <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
      {language}
    </span>
  );
}

function SiteUrlLink({ siteUrls }: { siteUrls: unknown }) {
  const data = (siteUrls as SiteUrls | null) ?? null;
  const main = primaryUrl(data);
  const total = totalLinks(data);

  if (!main) return null;

  const href = /^https?:\/\//i.test(main) ? main : `https://${main}`;
  const display = main.replace(/^https?:\/\//i, "").replace(/\/$/, "");

  return (
    <div className="flex items-center gap-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-w-0 items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
        title={main}
        aria-label={`Abrir site: ${display}`}
      >
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{display}</span>
      </a>
      {total > 1 && (
        <span className="flex-shrink-0 rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          +{total - 1}
        </span>
      )}
    </div>
  );
}

function TeamSiglas({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

// ---------- Card individual ----------

function OfferCard({ offer }: { offer: Offer }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      {/* Linha 1: Nome + idioma */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm leading-tight">{offer.name || "—"}</span>
        <LanguageBadge language={offer.language} />
      </div>

      {/* Barra de progresso */}
      <MiniProgressBar offer={offer} />

      {/* Statuses principais */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <StatusChip value={offer.validation} label="Validação" />
        <StatusChip value={offer.campaignsActive} label="Campanhas" />
        <StatusChip value={offer.scale} label="Escala" />
      </div>

      {/* Equipe: copy/editor */}
      {(offer.copyVsl || offer.copyAds || offer.editorAds || offer.editorVsl) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <TeamSiglas label="Copy VSL" value={offer.copyVsl} />
          <TeamSiglas label="Copy Ads" value={offer.copyAds} />
          <TeamSiglas label="Editor Ads" value={offer.editorAds} />
          <TeamSiglas label="Editor VSL" value={offer.editorVsl} />
        </div>
      )}

      {/* Ads editados + rejeitados */}
      {(offer.adsEditedCount !== null || offer.adsRejectedCount !== null) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {offer.adsEditedCount !== null && offer.adsEditedCount > 0 && (
            <span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {offer.adsEditedCount}
              </span>{" "}
              ads editados
            </span>
          )}
          {offer.adsRejectedCount !== null && offer.adsRejectedCount > 0 && (
            <span>
              <span className="font-mono font-medium text-danger tabular-nums">
                {offer.adsRejectedCount}
              </span>{" "}
              rejeitados
            </span>
          )}
        </div>
      )}

      {/* Link de site VSL */}
      <SiteUrlLink siteUrls={offer.siteUrls} />

      {/* Observações */}
      {offer.observations && (
        <p className="text-xs text-muted-foreground line-clamp-2">{offer.observations}</p>
      )}
    </div>
  );
}

// ---------- Componente principal ----------

export function OfferCardsMobile({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) return null;

  return (
    <div className="space-y-2">
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
      <p className="px-1 text-[11px] text-muted-foreground tabular-nums">
        {offers.length} ofertas &middot; consulta somente leitura &mdash; edite no desktop
      </p>
    </div>
  );
}
