import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b py-3 px-4">
      <Shimmer className="h-4 w-32 shrink-0" />
      <Shimmer className="h-4 flex-1" />
      <Shimmer className="h-5 w-20 rounded-full" />
      <Shimmer className="h-4 w-16" />
    </div>
  );
}

export default function TriagemLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando triagem">
      <div className="space-y-1">
        <Shimmer className="h-7 w-48" />
        <Shimmer className="h-4 w-72" />
      </div>
      <div className="rounded-xl border bg-card ring-1 ring-foreground/10 overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <Shimmer className="h-4 w-36" />
          <Shimmer className="h-7 w-24 rounded-md" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
