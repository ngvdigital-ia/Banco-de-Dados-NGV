import Link from "next/link";
import { ClipboardCheck, ArrowRight } from "lucide-react";

export function TriagemPlaceholder() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-md">
        <ClipboardCheck
          className="h-4 w-4 text-primary"
          aria-hidden="true"
        />
        <span className="text-sm font-medium">Triagem</span>
        <Link
          href="/agentes/triagem"
          className="text-xs text-primary hover:underline ml-auto flex items-center gap-1"
        >
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <Link
        href="/agentes/triagem"
        className="block bg-card border rounded-md p-6 text-center hover:bg-muted/40 transition-colors cursor-pointer"
      >
        <ClipboardCheck
          className="h-6 w-6 text-primary mx-auto"
          aria-hidden="true"
        />
        <p className="text-sm font-medium mt-2">Ver candidatos triados</p>
        <p className="text-xs text-muted-foreground mt-1">
          Lista, filtros e detalhes
        </p>
      </Link>
    </div>
  );
}
