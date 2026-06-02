import { cn } from "@/lib/utils"

/**
 * Skeleton com shimmer animado.
 * O shimmer usa um gradiente que percorre o elemento da esquerda pra direita,
 * dando feedback visual de carregamento mais rico que o pulse simples.
 * Respeita prefers-reduced-motion: cai de volta pra animate-pulse.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // Base
        "rounded-md bg-muted",
        // Shimmer: gradiente animado sobre a cor de base
        "relative overflow-hidden",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent",
        "before:translate-x-[-100%]",
        "before:animate-[shimmer_1.6s_ease-in-out_infinite]",
        // Fallback acessível: prefers-reduced-motion desativa o shimmer e usa pulse
        "motion-reduce:before:hidden motion-reduce:animate-pulse",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
