import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  [
    // Base styles
    "w-full min-w-0 rounded-md border bg-transparent transition-[color,box-shadow] outline-none",
    "file:text-foreground file:inline-flex file:border-0 file:bg-transparent file:font-medium",
    "placeholder:text-muted-foreground",
    "selection:bg-primary selection:text-primary-foreground",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    // Focus styles
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    // Error styles
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  ],
  {
    variants: {
      size: {
        sm: "h-8 px-2.5 py-1 text-sm file:h-6 file:text-xs",
        default: "h-9 px-3 py-1 text-base md:text-sm file:h-7 file:text-sm",
        lg: "h-10 px-3.5 py-1.5 text-base file:h-8 file:text-sm",
      },
      variant: {
        default: "border-input shadow-xs dark:bg-input/30",
        ghost: "border-transparent bg-transparent shadow-none hover:bg-accent",
        filled: "border-transparent bg-muted shadow-none focus-visible:bg-background",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

function Input({ className, type, size, variant, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size, variant, className }))}
      {...props}
    />
  )
}

export { Input, inputVariants }
