"use client";

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/insights-utils";

// ============================================================================
// GrowthBadge Component
// ============================================================================

interface GrowthBadgeProps {
  value: number;
  className?: string;
  size?: "sm" | "md";
}

export function GrowthBadge({ value, className, size = "sm" }: GrowthBadgeProps): ReactNode {
  if (value === 0) return null;

  const isPositive = value > 0;
  const iconSize = size === "sm" ? "size-3" : "size-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        textSize,
        isPositive ? "text-success" : "text-destructive",
        className
      )}
    >
      {isPositive ? (
        <TrendingUp className={iconSize} />
      ) : (
        <TrendingDown className={iconSize} />
      )}
      {isPositive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

// ============================================================================
// KPICard Component
// ============================================================================

type KPIFormat = "number" | "percent" | "multiplier";

interface KPICardProps {
  title: string;
  value: number;
  growth?: number;
  icon: React.ReactNode;
  isLoading?: boolean;
  format?: KPIFormat;
  periodLabel: string;
  suffix?: string;
  hint?: string;
}

function formatKPIValue(value: number, format: KPIFormat): string {
  switch (format) {
    case "percent":
      return `${value.toFixed(2)}%`;
    case "multiplier":
      return `${value.toFixed(1)}x`;
    default:
      return formatNumber(value);
  }
}

export function KPICard({
  title,
  value,
  growth,
  icon,
  isLoading,
  format = "number",
  periodLabel,
  suffix,
  hint,
}: KPICardProps): ReactNode {
  if (isLoading) {
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">
          {formatKPIValue(value, format)}
          {suffix && (
            <span className="ml-1 text-base font-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </div>
        {growth !== undefined && (
          <div className="flex items-center gap-1">
            <GrowthBadge value={growth} />
            {growth !== 0 && (
              <span className="text-xs text-muted-foreground">
                vs {periodLabel}
              </span>
            )}
          </div>
        )}
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Heatmap Legend Component
// ============================================================================

export function HeatmapLegend(): ReactNode {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-xs text-muted-foreground">低</span>
      <div className="flex gap-1">
        <div className="size-4 rounded-sm bg-muted" />
        <div className="size-4 rounded-sm bg-primary/20" />
        <div className="size-4 rounded-sm bg-primary/40" />
        <div className="size-4 rounded-sm bg-primary/70" />
        <div className="size-4 rounded-sm bg-primary" />
      </div>
      <span className="text-xs text-muted-foreground">高</span>
    </div>
  );
}
