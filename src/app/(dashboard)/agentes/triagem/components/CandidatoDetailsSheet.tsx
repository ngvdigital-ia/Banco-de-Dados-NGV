"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { CandidatoTriado } from "@/lib/agentes/triagem/client";

interface Props {
  candidato: CandidatoTriado | null;
  onClose: () => void;
}

function classifColor(c: string): string {
  if (c === "MUITO_BOM") return "bg-green-100 text-green-900";
  if (c === "TALVEZ") return "bg-amber-100 text-amber-900";
  if (c === "DESCARTAR") return "bg-slate-100 text-slate-700";
  return "bg-muted text-muted-foreground";
}

export function CandidatoDetailsSheet({ candidato, onClose }: Props) {
  return (
    <Sheet open={!!candidato} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{candidato?.nome || "Candidato"}</SheetTitle>
          {candidato?.email && (
            <SheetDescription>{candidato.email}</SheetDescription>
          )}
        </SheetHeader>

        {candidato && (
          <div className="mt-6 space-y-4 px-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="capitalize">
                {String(candidato.vaga) || "?"}
              </Badge>
              <Badge
                className={`${classifColor(String(candidato.classificacao))} font-medium`}
              >
                {String(candidato.classificacao)}
              </Badge>
            </div>

            {candidato.justificativa && (
              <section>
                <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Justificativa
                </h3>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {candidato.justificativa}
                </p>
              </section>
            )}

            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                Submetido em
              </h3>
              <p className="text-sm text-muted-foreground">
                {new Date(candidato.timestamp).toLocaleString("pt-BR")}
              </p>
            </section>

            {candidato.form_original && (
              <section>
                <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Respostas do formulário
                </h3>
                <dl className="space-y-2 text-sm">
                  {Object.entries(candidato.form_original).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="whitespace-pre-wrap">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <details className="mt-6">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:underline">
                Ver dados brutos
              </summary>
              <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-x-auto">
                {JSON.stringify(candidato.raw, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
