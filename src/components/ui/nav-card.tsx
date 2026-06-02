import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

interface NavCardProps {
  title: string
  description: string
  href: string
  icon: React.ElementType
  className?: string
}

function NavCard({ title, description, href, icon: Icon, className }: NavCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        // Base
        "group relative flex items-start gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground ring-1 ring-foreground/5",
        // Hover lift + border highlight
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40",
        // Focus ring (teclado)
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Motion-safe: desativa transform em prefers-reduced-motion
        "motion-reduce:hover:translate-y-0 motion-reduce:transition-none",
        className
      )}
    >
      {/* Ícone num container com fundo indigo/10 */}
      <div className="flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2.5">
        <Icon className="size-5 text-primary" aria-hidden="true" />
      </div>

      {/* Texto */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold leading-snug">{title}</span>
        <span className="text-sm text-muted-foreground leading-relaxed">{description}</span>
      </div>

      {/* Seta que desliza no hover */}
      <ArrowRight
        className={cn(
          "mt-0.5 size-4 shrink-0 text-muted-foreground",
          "transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary",
          "motion-reduce:group-hover:translate-x-0"
        )}
        aria-hidden="true"
      />
    </Link>
  )
}

export { NavCard, type NavCardProps }
