import * as React from "react"

import { cn } from "@/lib/utils"

interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
}

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
}

function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-12 text-center",
        className
      )}
      role="status"
      aria-label={title}
    >
      {/* Ícone em círculo muted */}
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Textos */}
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Ação opcional */}
      {action && (
        <div className="mt-1">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export { EmptyState, type EmptyStateProps, type EmptyStateAction }
