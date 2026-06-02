import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  );
}

function MemberRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b py-3 px-4">
      <Shimmer className="h-4 w-6 shrink-0" />
      <Shimmer className="h-4 w-32" />
      <Shimmer className="h-5 w-24 rounded-md" />
      <Shimmer className="h-4 w-8" />
      <Shimmer className="h-4 w-8" />
      <Shimmer className="h-4 w-8" />
      <Shimmer className="h-4 w-8" />
      <Shimmer className="h-5 w-16 rounded-md" />
      <Shimmer className="h-5 w-14 rounded-md" />
    </div>
  );
}

export default function TeamLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando performance da equipe">
      <div className="space-y-1">
        <Shimmer className="h-7 w-52" />
        <Shimmer className="h-4 w-96" />
      </div>
      <Shimmer className="h-8 w-full max-w-lg rounded-lg" />
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-4 py-3">
          <Shimmer className="h-5 w-44" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => <MemberRowSkeleton key={i} />)}
      </div>
    </div>
  );
}
