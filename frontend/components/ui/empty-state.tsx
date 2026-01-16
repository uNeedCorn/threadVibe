import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Button } from "./button"

const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center",
  {
    variants: {
      size: {
        sm: "py-8 px-4",
        default: "py-12 px-4",
        lg: "py-16 px-6",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const iconContainerVariants = cva(
  "relative flex items-center justify-center rounded-full bg-muted text-muted-foreground mb-4",
  {
    variants: {
      size: {
        sm: "size-12 [&_svg]:size-5",
        default: "size-16 [&_svg]:size-6",
        lg: "size-20 [&_svg]:size-8",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

export interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
  variant?: "default" | "outline" | "ghost"
}

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
  /** 圖示 */
  icon?: React.ReactNode
  /** 標題 */
  title: string
  /** 描述文字 */
  description?: string
  /** 主要行動按鈕 */
  action?: EmptyStateAction
  /** 次要行動按鈕 */
  secondaryAction?: EmptyStateAction
  /** 是否顯示 pulse 動畫 */
  animate?: boolean
}

function EmptyState({
  className,
  size,
  icon,
  title,
  description,
  action,
  secondaryAction,
  animate = true,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(emptyStateVariants({ size, className }))}
      {...props}
    >
      {/* 圖示容器 */}
      {icon && (
        <div className="relative mb-4">
          {/* 背景 pulse 效果 */}
          {animate && (
            <div
              className={cn(
                "absolute inset-0 rounded-full bg-primary/5",
                "animate-pulse-ring"
              )}
            />
          )}
          <div className={cn(iconContainerVariants({ size }))}>
            {icon}
          </div>
        </div>
      )}

      {/* 標題 */}
      <h3
        className={cn(
          "font-semibold text-foreground",
          size === "sm" && "text-base",
          size === "default" && "text-lg",
          size === "lg" && "text-xl"
        )}
      >
        {title}
      </h3>

      {/* 描述 */}
      {description && (
        <p
          className={cn(
            "mt-2 text-muted-foreground max-w-sm",
            size === "sm" && "text-sm",
            size === "default" && "text-sm",
            size === "lg" && "text-base"
          )}
        >
          {description}
        </p>
      )}

      {/* 行動按鈕 */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {action && (
            <Button
              variant={action.variant || "default"}
              onClick={action.onClick}
              asChild={!!action.href}
            >
              {action.href ? (
                <a href={action.href}>{action.label}</a>
              ) : (
                action.label
              )}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant || "outline"}
              onClick={secondaryAction.onClick}
              asChild={!!secondaryAction.href}
            >
              {secondaryAction.href ? (
                <a href={secondaryAction.href}>{secondaryAction.label}</a>
              ) : (
                secondaryAction.label
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export { EmptyState, emptyStateVariants }
