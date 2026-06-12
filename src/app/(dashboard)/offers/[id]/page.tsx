import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { getOfferDetail } from "./actions";
import { getFullName, FORMAT_LABELS } from "@/lib/team-utils";
import type { SiteUrls, CustomLink } from "@/lib/site-urls-types";

export const dynamic = "force-dynamic";

// ── helpers ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  SIM: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  NAO: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  "EM ANDAMENTO":
    "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
  "NÃO DEU CERTO":
    "bg-zinc-100 text-zinc-500 border-zinc-300 line-through dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-600",
};

function statusColor(val: string | null) {
  const upper = (val ?? "NAO").toUpperCase().trim();
  return STATUS_COLORS[upper] ?? STATUS_COLORS["NAO"];
}

function StatusBadge({ value }: { value: string | null }) {
  const display = (value ?? "NAO").toUpperCase().trim();
  const label =
    display === "NÃO DEU CERTO"
      ? "N/CERTO"
      : display === "EM ANDAMENTO"
        ? "ANDAMENTO"
        : display;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColor(value)}`}
    >
      {label}
    </span>
  );
}

function LangBadge({ lang }: { lang: string }) {
  return (
    <span className="inline-flex items-center rounded border border-blue-300 bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
      {lang}
    </span>
  );
}

function scaleBadgeColor(val: string | null) {
  const v = (val ?? "NAO").toUpperCase();
  if (v === "SIM") return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700";
  if (v === "EM ANDAMENTO") return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700";
  return "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600";
}

function ScaleBadge({ scale, preScale }: { scale: string | null; preScale: string | null }) {
  const sUp = (scale ?? "NAO").toUpperCase();
  const psUp = (preScale ?? "NAO").toUpperCase();

  if (sUp === "SIM") return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${scaleBadgeColor(scale)}`}>
      ESCALA
    </span>
  );
  if (psUp === "SIM" || psUp === "EM ANDAMENTO") return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${scaleBadgeColor(preScale)}`}>
      PRÉ-ESCALA
    </span>
  );
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${scaleBadgeColor(null)}`}>
      SEM ESCALA
    </span>
  );
}

function formatDate(d: Date | string | null) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDatetime(d: Date | string | null) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Type guard para SiteUrls (jsonb vem como unknown do Drizzle)
function parseSiteUrls(raw: unknown): SiteUrls | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    domain: typeof r.domain === "string" ? r.domain : undefined,
    vsl: typeof r.vsl === "string" ? r.vsl : undefined,
    quiz: typeof r.quiz === "string" ? r.quiz : undefined,
    whites: Array.isArray(r.whites) ? (r.whites as unknown[]).filter((u): u is string => typeof u === "string") : undefined,
    custom: Array.isArray(r.custom)
      ? (r.custom as unknown[]).flatMap((c) => {
          if (c && typeof c === "object" && !Array.isArray(c)) {
            const obj = c as Record<string, unknown>;
            if (typeof obj.label === "string" && typeof obj.url === "string") {
              return [{ label: obj.label, url: obj.url } satisfies CustomLink];
            }
          }
          return [];
        })
      : undefined,
  };
}

// Type guard para adsEditedByPerson / adsCopyByPerson (jsonb)
function parsePersonMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(r)) {
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    if (!isNaN(n) && n > 0) out[k] = n;
  }
  return out;
}

// Type guard para changesJson do changelog
function parseChangesJson(raw: unknown): Record<string, { from: unknown; to: unknown }> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, { from: unknown; to: unknown }>;
}

// Rótulos legíveis para os campos do changelog
const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  copyVsl: "Copy VSL",
  copyAds: "Copy ADS",
  editorAds: "Editor Ads",
  editorVsl: "Editor VSL",
  ticket: "Ticket",
  language: "Língua",
  copyVslStatus: "Status VSL",
  copyCriativosStatus: "Status Criativos",
  vslInVturb: "VSL no Vturb",
  adsCopyByPerson: "Ads Copy (por pessoa)",
  adsEditedCount: "Ads Editados (qtd)",
  adsEditedByPerson: "Ads Editados (por pessoa)",
  adsRejectedCount: "Ads Rejeitados",
  editorStatus: "Status Editores",
  campaignsActive: "Campanhas Ativas",
  validation: "Validação",
  preScale: "Pré-Escala",
  scale: "Escala",
  productCreated: "Produto Criado",
  productApproved: "Produto Aprovado",
  siteCreated: "Site Criado",
  siteUrls: "Domínios",
  gender: "Gênero",
  adFormat: "Formato do Ad",
  observations: "Observações",
};

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key;
}

function renderChangeValue(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v || "-";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// ── Seção de card reutilizável ────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="w-36 flex-shrink-0 text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[13px] text-foreground">{children}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) notFound();

  const result = await getOfferDetail(id);
  if (!result) notFound();

  const { offer, changelog } = result;
  const siteUrls = parseSiteUrls(offer.siteUrls);
  const adsEditedByPerson = parsePersonMap(offer.adsEditedByPerson);
  const adsCopyByPerson = parsePersonMap(offer.adsCopyByPerson);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/offers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Ofertas
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {offer.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <LangBadge lang={offer.language} />
          <StatusBadge value={offer.validation} />
          <ScaleBadge scale={offer.scale} preScale={offer.preScale} />
          {offer.adFormat && (
            <span className="inline-flex items-center rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {FORMAT_LABELS[offer.adFormat] ?? offer.adFormat}
            </span>
          )}
        </div>
        <div className="flex gap-4 text-[11px] text-muted-foreground">
          <span>Criada em {formatDate(offer.createdAt)}</span>
          <span>Atualizada em {formatDate(offer.updatedAt)}</span>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Equipe */}
        <Card title="Equipe">
          <FieldRow label="Copy VSL">
            {offer.copyVsl ? getFullName(offer.copyVsl) : <span className="text-muted-foreground">-</span>}
          </FieldRow>
          <FieldRow label="Copy ADS">
            {offer.copyAds ? (
              offer.copyAds
                .split(/\s*[&,]\s*/)
                .map((s) => getFullName(s.trim()))
                .join(" & ")
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </FieldRow>
          <FieldRow label="Editor Ads">
            {offer.editorAds ? (
              offer.editorAds
                .split(/\s*[&,]\s*/)
                .map((s) => getFullName(s.trim()))
                .join(" & ")
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </FieldRow>
          <FieldRow label="Editor VSL">
            {offer.editorVsl ? getFullName(offer.editorVsl) : <span className="text-muted-foreground">-</span>}
          </FieldRow>
          {offer.ticket && (
            <FieldRow label="Ticket">
              <span className="font-mono tabular-nums">{offer.ticket}</span>
            </FieldRow>
          )}
        </Card>

        {/* Status do pipeline */}
        <Card title="Status do Pipeline">
          {(
            [
              ["Copy VSL", offer.copyVslStatus],
              ["Copy Criativos", offer.copyCriativosStatus],
              ["VSL no Vturb", offer.vslInVturb],
              ["Site Criado", offer.siteCreated],
              ["Campanhas Ativas", offer.campaignsActive],
              ["Produto Criado", offer.productCreated],
              ["Produto Aprovado", offer.productApproved],
              ["Validação", offer.validation],
              ["Pré-Escala", offer.preScale],
              ["Escala", offer.scale],
            ] as [string, string | null][]
          ).map(([label, val]) => (
            <FieldRow key={label} label={label}>
              <StatusBadge value={val} />
            </FieldRow>
          ))}
        </Card>

        {/* Ads */}
        <Card title="Ads">
          <FieldRow label="Ads Editados">
            <span className="font-mono tabular-nums font-medium">{offer.adsEditedCount ?? 0}</span>
          </FieldRow>
          <FieldRow label="Ads Rejeitados">
            <span className="font-mono tabular-nums font-medium">{offer.adsRejectedCount ?? 0}</span>
          </FieldRow>
          {Object.keys(adsCopyByPerson).length > 0 && (
            <FieldRow label="Copy por pessoa">
              <span className="flex flex-wrap gap-1.5">
                {Object.entries(adsCopyByPerson).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[11px]">
                    <span className="font-semibold">{k}</span>
                    <span className="text-muted-foreground">:{v}</span>
                  </span>
                ))}
              </span>
            </FieldRow>
          )}
          {Object.keys(adsEditedByPerson).length > 0 && (
            <FieldRow label="Edição por pessoa">
              <span className="flex flex-wrap gap-1.5">
                {Object.entries(adsEditedByPerson).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[11px]">
                    <span className="font-semibold">{k}</span>
                    <span className="text-muted-foreground">:{v}</span>
                  </span>
                ))}
              </span>
            </FieldRow>
          )}
          {offer.gender && (
            <FieldRow label="Gênero">{offer.gender}</FieldRow>
          )}
          {offer.observations && (
            <FieldRow label="Observações">
              <span className="whitespace-pre-wrap text-[12px]">{offer.observations}</span>
            </FieldRow>
          )}
        </Card>

        {/* Domínios & Links */}
        <Card title="Domínios & Links">
          {!siteUrls ? (
            <p className="text-sm text-muted-foreground">Nenhum domínio cadastrado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {siteUrls.domain && (
                <FieldRow label="Domínio">
                  <span className="font-mono text-[12px]">{siteUrls.domain}</span>
                </FieldRow>
              )}
              {siteUrls.vsl && (
                <FieldRow label="VSL">
                  <a
                    href={siteUrls.vsl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate max-w-[140px]">{siteUrls.vsl.replace(/^https?:\/\//i, "")}</span>
                  </a>
                </FieldRow>
              )}
              {siteUrls.quiz && (
                <FieldRow label="Quiz">
                  <a
                    href={siteUrls.quiz}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate max-w-[140px]">{siteUrls.quiz.replace(/^https?:\/\//i, "")}</span>
                  </a>
                </FieldRow>
              )}
              {siteUrls.whites && siteUrls.whites.length > 0 && (
                <div>
                  <span className="text-[12px] text-muted-foreground">Whites ({siteUrls.whites.length})</span>
                  <ul className="mt-1 space-y-1">
                    {siteUrls.whites.map((u, i) => (
                      <li key={i}>
                        <a
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate max-w-[160px]">{u.replace(/^https?:\/\//i, "")}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {siteUrls.custom && siteUrls.custom.length > 0 && (
                <div>
                  <span className="text-[12px] text-muted-foreground">Outros links ({siteUrls.custom.length})</span>
                  <ul className="mt-1 space-y-1">
                    {siteUrls.custom.map((c, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="text-[11px] font-medium text-foreground">{c.label}:</span>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{c.url.replace(/^https?:\/\//i, "")}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Changelog */}
      <Card title="Histórico de Alterações">
        {changelog.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Quando</th>
                  <th className="pb-2 pr-4 text-left font-medium">Campo</th>
                  <th className="pb-2 pr-4 text-left font-medium">De</th>
                  <th className="pb-2 pr-4 text-left font-medium">Para</th>
                  <th className="pb-2 text-left font-medium">Quem</th>
                </tr>
              </thead>
              <tbody>
                {changelog.map((entry) => {
                  const changes = parseChangesJson(entry.changesJson);
                  if (!changes) {
                    // Entrada sem changesJson detalhado — mostra action apenas
                    return (
                      <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 pr-4 text-[12px] text-muted-foreground whitespace-nowrap">
                          {formatDatetime(entry.createdAt)}
                        </td>
                        <td className="py-2 pr-4 text-[12px]" colSpan={3}>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                            {entry.action}
                          </span>
                        </td>
                        <td className="py-2 text-[12px] text-muted-foreground font-mono">
                          {entry.userId ? entry.userId.slice(-8) : "-"}
                        </td>
                      </tr>
                    );
                  }
                  // Expande cada campo alterado em uma linha
                  return Object.entries(changes).map(([field, diff]) => (
                    <tr
                      key={`${entry.id}-${field}`}
                      className="border-b border-border/50 hover:bg-muted/30"
                    >
                      <td className="py-2 pr-4 text-[12px] text-muted-foreground whitespace-nowrap">
                        {formatDatetime(entry.createdAt)}
                      </td>
                      <td className="py-2 pr-4 text-[12px] font-medium">
                        {fieldLabel(field)}
                      </td>
                      <td className="py-2 pr-4 text-[12px] text-muted-foreground max-w-[180px] truncate">
                        <span title={renderChangeValue(diff?.from)}>
                          {renderChangeValue(diff?.from)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-[12px] max-w-[180px] truncate">
                        <span title={renderChangeValue(diff?.to)}>
                          {renderChangeValue(diff?.to)}
                        </span>
                      </td>
                      <td className="py-2 text-[12px] text-muted-foreground font-mono">
                        {entry.userId ? entry.userId.slice(-8) : "-"}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
