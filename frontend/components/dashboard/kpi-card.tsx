"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KPICardProps {
  /** KPI 標題 */
  title: string;
  /** 當前數值 */
  value: number;
  /** 前期數值（用於計算變化） */
  previousValue?: number;
  /** 數值格式 */
  format?: "number" | "percentage";
  /** 圖示 */
  icon?: React.ReactNode;
  /** 載入狀態 */
  isLoading?: boolean;
  /** 比較期間標籤（預設：vs 上週） */
  periodLabel?: string;
  /** 卡片變體 */
  variant?: "default" | "compact" | "highlight";
  /** 點擊事件 */
  onClick?: () => void;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/** 成長指標 Badge */
function GrowthBadge({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        "transition-colors duration-200",
        isPositive && "bg-success/10 text-success",
        isNegative && "bg-destructive/10 text-destructive",
        isNeutral && "bg-muted text-muted-foreground"
      )}
    >
      {isPositive && <ArrowUpRight className="size-3" />}
      {isNegative && <ArrowDownRight className="size-3" />}
      {isNeutral && <Minus className="size-3" />}
      <span>
        {isPositive && "+"}
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

export function KPICard({
  title,
  value,
  previousValue,
  format = "number",
  icon,
  isLoading = false,
  periodLabel = "vs 上週",
  variant = "default",
  onClick,
}: KPICardProps) {
  const change = previousValue !== undefined ? calculateChange(value, previousValue) : null;
  const displayValue = format === "percentage" ? `${value.toFixed(1)}%` : formatNumber(value);
  const isInteractive = !!onClick;

  if (isLoading) {
    return (
      <Card variant={variant === "highlight" ? "highlight" : "default"} padding="lg">
        <CardHeader className="flex flex-row items-center justify-between pb-3 px-0 pt-0">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="size-10 rounded-lg" />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Skeleton className="h-9 w-28 mb-3" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      variant={variant === "highlight" ? "highlight" : isInteractive ? "interactive" : "default"}
      padding="lg"
      className={cn(
        "group",
        isInteractive && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-3 px-0 pt-0">
        {/* 標題 */}
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>

        {/* 圖示容器 */}
        {icon && (
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-lg",
              "bg-primary/10 text-primary",
              "transition-all duration-200",
              "group-hover:bg-primary group-hover:text-primary-foreground",
              "[&_svg]:size-5"
            )}
          >
            {icon}
          </div>
        )}
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {/* 主數值 - 使用 mono 字體 */}
        <div
          className={cn(
            "text-3xl font-bold tracking-tight",
            "font-mono-data", // 自訂 mono 數據字體
            "transition-colors duration-200",
            variant === "highlight" && "text-primary"
          )}
        >
          {displayValue}
        </div>

        {/* 成長指標 */}
        {change !== null && (
          <div className="mt-3 flex items-center gap-2">
            <GrowthBadge value={change} />
            <span className="text-xs text-muted-foreground">{periodLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { GrowthBadge };
