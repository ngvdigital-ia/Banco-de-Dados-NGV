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
      <Shimmer className="h-7 w-12" />
      <Shimmer className="h-3 w-16" />
    </div>
  );
}

function OfferRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b py-3 px-4">
      <Shimmer className="h-4 flex-1 max-w-[200px]" />
      <Shimmer className="h-4 w-20" />
      <Shimmer className="h-4 w-12" />
      <Shimmer className="h-5 w-20 rounded-md" />
      <Shimmer className="h-4 w-8" />
      <Shimmer className="h-4 w-8" />
      <Shimmer className="h-4 w-10" />
      <Shimmer className="h-4 w-16" />
    </div>
  );
}

export default function OffersRankingLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando ranking de ofertas">
      <div className="space-y-1">
        <Shimmer className="h-7 w-48" />
        <Shimmer className="h-4 w-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-4 py-3">
          <Shimmer className="h-5 w-36" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => <OfferRowSkeleton key={i} />)}
      </div>
    </div>
  );
}
