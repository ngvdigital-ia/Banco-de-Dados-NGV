import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        success:
          "bg-success-muted text-success-muted-foreground border-success",
        warning:
          "bg-warning-muted text-warning-muted-foreground border-warning",
        danger:
          "bg-danger-muted text-danger-muted-foreground border-danger",
        info:
          "bg-info-muted text-info-muted-foreground border-info",
        neutral:
          "bg-muted text-muted-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {}

function StatusBadge({ className, variant, children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ variant }), className)}
      {...props}
    >
      {children}
    </span>
  )
}

export { StatusBadge, statusBadgeVariants }
