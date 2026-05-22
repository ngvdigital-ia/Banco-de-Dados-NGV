import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback instantâneo enquanto o server component agrega as ofertas
 * (ClickUp + n8n + Anthropic — pode levar alguns segundos).
 * Não acelera a agregação, mas dá feedback imediato em vez de tela travada.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-56" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((coluna) => (
            <div key={coluna} className="space-y-2">
              <Skeleton className="h-9 w-full rounded-md" />
              {[0, 1, 2].map((card) => (
                <Skeleton key={card} className="h-24 w-full rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
