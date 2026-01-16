"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BenchmarkConfig {
  /** 基準值 */
  value: number;
  /** 總貼文數（用於判斷是否顯示基準比較） */
  totalPosts: number;
  /** 最少需要多少貼文才顯示（預設 10） */
  minPosts?: number;
}

export interface KPICardProps {
  /** KPI 標題 */
  title: string;
  /** 當前數值 */
  value: number;
  /** 前期數值（用於計算變化，與 growth 二擇一） */
  previousValue?: number;
  /** 預先計算的成長率（與 previousValue 二擇一） */
  growth?: number;
  /** 數值格式 */
  format?: "number" | "percentage";
  /** 圖示 */
  icon?: React.ReactNode;
  /** 載入狀態 */
  isLoading?: boolean;
  /** 比較期間標籤（預設：vs 上週） */
  periodLabel?: string;
  /** 卡片變體 */
  variant?: "default" | "compact" | "highlight" | "simple";
  /** 點擊事件 */
  onClick?: () => void;
  /** 基準比較配置 */
  benchmark?: BenchmarkConfig;
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

/** 成長指標 Badge（圓角藥丸樣式，用於 default/highlight variant） */
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

/** 成長指標 Badge（簡約樣式，用於 simple variant） */
function GrowthBadgeSimple({ value, className }: { value: number; className?: string }) {
  if (value === 0) return null;

  const isPositive = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isPositive ? "text-success" : "text-destructive",
        className
      )}
    >
      {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {isPositive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

/** 基準比較 Badge */
function BenchmarkBadge({
  currentValue,
  benchmarkValue,
  totalPosts,
  minPosts = 10,
}: {
  currentValue: number;
  benchmarkValue: number;
  totalPosts: number;
  minPosts?: number;
}) {
  // 貼文數不足時不顯示
  if (totalPosts < minPosts) return null;
  if (benchmarkValue === 0) return null;

  const diff = ((currentValue - benchmarkValue) / benchmarkValue) * 100;
  const isAbove = diff > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isAbove ? "text-info" : "text-warning"
      )}
    >
      {isAbove ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {isAbove ? "高於" : "低於"}基準 {Math.abs(diff).toFixed(1)}%
    </span>
  );
}

export function KPICard({
  title,
  value,
  previousValue,
  growth,
  format = "number",
  icon,
  isLoading = false,
  periodLabel = "vs 上週",
  variant = "default",
  onClick,
  benchmark,
}: KPICardProps) {
  // 支援兩種方式：1) 傳入 previousValue 自動計算 2) 直接傳入 growth
  const change = growth ?? (previousValue !== undefined ? calculateChange(value, previousValue) : null);
  const displayValue = format === "percentage" ? `${value.toFixed(2)}%` : formatNumber(value);
  const isInteractive = !!onClick;
  const isSimple = variant === "simple";

  // Simple variant 的 loading 狀態
  if (isLoading && isSimple) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="size-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-1 h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  // Default/highlight variant 的 loading 狀態
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

  // Simple variant（用於 insights 頁面等密集排列場景）
  if (isSimple) {
    return (
      <Card className="group">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon && (
            <div
              className={cn(
                "text-muted-foreground transition-all duration-200",
                "group-hover:text-primary group-hover:scale-110"
              )}
            >
              {icon}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{displayValue}</div>
          {change !== null && (
            <div className="flex items-center gap-1">
              <GrowthBadgeSimple value={change} />
              {change !== 0 && (
                <span className="text-xs text-muted-foreground">{periodLabel}</span>
              )}
            </div>
          )}
          {benchmark && (
            <div className="mt-1">
              <BenchmarkBadge
                currentValue={value}
                benchmarkValue={benchmark.value}
                totalPosts={benchmark.totalPosts}
                minPosts={benchmark.minPosts}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default/highlight variant
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
            "font-mono-data",
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

        {/* 基準比較 */}
        {benchmark && (
          <div className="mt-2">
            <BenchmarkBadge
              currentValue={value}
              benchmarkValue={benchmark.value}
              totalPosts={benchmark.totalPosts}
              minPosts={benchmark.minPosts}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { GrowthBadge, GrowthBadgeSimple, BenchmarkBadge };
