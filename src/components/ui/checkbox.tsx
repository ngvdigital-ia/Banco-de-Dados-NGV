"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Checkbox — base-ui/react/checkbox com identidade NGV.
 *
 * Usa --primary como cor de marca (indigo). Visível em light e dark.
 * Suporta estado indeterminate (para "selecionar todos").
 *
 * Acessibilidade:
 * - role="checkbox" via base-ui
 * - focus-visible com ring em --ring (indigo)
 * - Contraste AA: check branco sobre primary indigo
 *
 * Uso:
 *   <Checkbox checked={checked} onCheckedChange={setChecked} />
 *   <Checkbox indeterminate />
 */

const Checkbox = React.forwardRef<
  HTMLElement,
  CheckboxPrimitive.Root.Props
>(({ className, indeterminate, ...props }, ref) => {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      data-slot="checkbox"
      indeterminate={indeterminate}
      className={cn(
        // Estrutura base
        "peer relative shrink-0 size-4 rounded-[4px] border border-input bg-background",
        // Transição suave
        "transition-colors duration-150",
        // Estado unchecked hover
        "hover:border-primary/60",
        // Estado checked: fundo primary, borda primary
        "data-checked:bg-primary data-checked:border-primary",
        // Estado indeterminate: mesma cor
        "data-indeterminate:bg-primary data-indeterminate:border-primary",
        // Foco visible: ring indigo
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring",
        // Desabilitado
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Dark: borda mais visível no estado inativo
        "dark:border-input dark:bg-input/30",
        "dark:data-checked:bg-primary dark:data-checked:border-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        keepMounted
        className={cn(
          "flex items-center justify-center text-primary-foreground",
          "absolute inset-0",
          "transition-opacity duration-100",
          "data-unchecked:opacity-0 data-indeterminate:opacity-100"
        )}
      >
        {indeterminate ? (
          <MinusIcon className="size-3 stroke-[3]" aria-hidden />
        ) : (
          <CheckIcon className="size-3 stroke-[3]" aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
