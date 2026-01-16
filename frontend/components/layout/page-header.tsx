import { cn } from "@/lib/utils";

interface PageHeaderBadge {
  label: string;
  variant?: "default" | "warning" | "info" | "admin";
}

interface PageHeaderProps {
  /** 頁面標題 */
  title: string;
  /** 頁面描述 */
  description?: string;
  /** 右側操作區塊（如 Tabs, ToggleGroup 等） */
  actions?: React.ReactNode;
  /** 標題旁的徽章 */
  badge?: PageHeaderBadge;
  /** 額外的 className */
  className?: string;
  /** 子元素（顯示在標題下方，actions 旁） */
  children?: React.ReactNode;
}

const badgeVariants = {
  default: "bg-muted text-muted-foreground",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  admin: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
};

/**
 * 統一的頁面標題元件
 *
 * @example 基本用法
 * ```tsx
 * <PageHeader
 *   title="總覽"
 *   description="本週成效概覽，快速掌握帳號表現"
 * />
 * ```
 *
 * @example 帶操作按鈕
 * ```tsx
 * <PageHeader
 *   title="排程管理"
 *   description="管理已排程的貼文"
 *   actions={
 *     <ToggleGroup type="single" value={viewMode} onValueChange={setViewMode}>
 *       <ToggleGroupItem value="calendar">日曆</ToggleGroupItem>
 *       <ToggleGroupItem value="list">清單</ToggleGroupItem>
 *     </ToggleGroup>
 *   }
 * />
 * ```
 *
 * @example 帶徽章（管理員頁面）
 * ```tsx
 * <PageHeader
 *   title="建立貼文"
 *   description="發布新貼文到 Threads"
 *   badge={{ label: "管理員", variant: "admin" }}
 * />
 * ```
 */
export function PageHeader({
  title,
  description,
  actions,
  badge,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1
            className={cn(
              "text-2xl font-bold",
              badge?.variant === "admin" && "text-orange-600"
            )}
          >
            {title}
          </h1>
          {badge && (
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                badgeVariants[badge.variant || "default"]
              )}
            >
              {badge.label}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
