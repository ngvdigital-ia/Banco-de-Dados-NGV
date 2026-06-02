import * as React from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  /** Ações posicionadas à direita (botões, filtros, etc.) */
  children?: React.ReactNode
  className?: string
}

function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      {/* Título + descrição */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>

      {/* Ações à direita */}
      {children && (
        <div className="flex shrink-0 items-center gap-2 sm:ml-4">{children}</div>
      )}
    </header>
  )
}

export { PageHeader, type PageHeaderProps }
