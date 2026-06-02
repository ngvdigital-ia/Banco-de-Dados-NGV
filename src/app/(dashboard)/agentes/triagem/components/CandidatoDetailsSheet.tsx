"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { CandidatoTriado } from "@/lib/agentes/triagem/client";
import { classifLabel, classifBadgeColor } from "@/lib/agentes/triagem/labels";

interface Props {
  candidato: CandidatoTriado | null;
  onClose: () => void;
}

export function CandidatoDetailsSheet({ candidato, onClose }: Props) {
  const formEntries = candidato?.form_original
    ? Object.entries(candidato.form_original)
    : [];

  return (
    <Sheet open={!!candidato} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pb-0">
          {/* Bloco de identidade do candidato */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <SheetTitle className="text-base leading-snug">
              {candidato?.nome || "Candidato"}
            </SheetTitle>
            {candidato?.email && (
              <SheetDescription className="mt-0.5 text-xs">
                {candidato.email}
              </SheetDescription>
            )}
            {candidato && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge
                  variant="outline"
                  className="capitalize text-xs font-medium"
                >
                  {String(candidato.vaga) || "?"}
                </Badge>
                <Badge
                  className={`${classifBadgeColor(String(candidato.classificacao))} text-xs font-semibold`}
                >
                  {classifLabel(String(candidato.classificacao))}
                </Badge>
              </div>
            )}
          </div>
        </SheetHeader>

        {candidato && (
          <div className="mt-5 space-y-5 px-1">
            {/* Justificativa */}
            {candidato.justificativa && (
              <>
                <section className="space-y-2">
                  <SectionLabel>Justificativa</SectionLabel>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {candidato.justificativa}
                  </p>
                </section>
                <Separator className="opacity-50" />
              </>
            )}

            {/* Data */}
            <section className="space-y-1.5">
              <SectionLabel>Submetido em</SectionLabel>
              <time
                dateTime={new Date(candidato.timestamp).toISOString()}
                className="tabular-nums text-sm text-muted-foreground"
              >
                {new Date(candidato.timestamp).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </section>

            {/* Respostas do formulário */}
            {formEntries.length > 0 && (
              <>
                <Separator className="opacity-50" />
                <section className="space-y-3">
                  <SectionLabel>Respostas do formulário</SectionLabel>
                  <dl className="space-y-3">
                    {formEntries.map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
                      >
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                          {k}
                        </dt>
                        <dd className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                          {String(v) || (
                            <span className="italic text-muted-foreground/60">—</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </>
            )}

            {/* Dados brutos */}
            <details className="group mt-2">
              <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-150 select-none list-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-3 w-3 transition-transform duration-150 group-open:rotate-90"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Dados brutos
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-border/50 bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                {JSON.stringify(candidato.raw, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}
