import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  );
}

function KpiCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <Shimmer className="h-3 w-24" />
      <Shimmer className="h-7 w-16" />
      <Shimmer className="h-3 w-20" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b py-3 px-4">
      <Shimmer className="h-4 flex-1" />
      <Shimmer className="h-5 w-16 rounded-md" />
      <Shimmer className="h-5 w-12 rounded-md" />
      <Shimmer className="h-4 w-20" />
      <Shimmer className="h-4 w-14" />
    </div>
  );
}

export default function CreativesLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando análise de criativos">
      <div className="space-y-1">
        <Shimmer className="h-7 w-52" />
        <Shimmer className="h-4 w-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-4 py-3">
          <Shimmer className="h-5 w-48" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} />)}
      </div>
    </div>
  );
}
