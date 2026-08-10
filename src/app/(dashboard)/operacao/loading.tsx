import { Skeleton } from "@/components/ui/skeleton";

export default function OperacaoLoading() {
  return (
    <div className="space-y-12" aria-label="Carregando operação" aria-busy="true">
      <div className="space-y-4 border-b pb-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-full max-w-2xl" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-none border-r" />)}
      </div>
      <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
      </div>
    </div>
  );
}
