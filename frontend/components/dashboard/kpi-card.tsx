"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  format?: "number" | "percentage";
  icon?: React.ReactNode;
  isLoading?: boolean;
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

export function KPICard({
  title,
  value,
  previousValue,
  format = "number",
  icon,
  isLoading = false,
}: KPICardProps) {
  const change = previousValue !== undefined ? calculateChange(value, previousValue) : null;
  const displayValue = format === "percentage" ? `${value.toFixed(1)}%` : formatNumber(value);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="size-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-16" />
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
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{displayValue}</div>
        {change !== null && (
          <div className="flex items-center gap-1 text-xs">
            {change > 0 ? (
              <>
                <TrendingUp className="size-3 text-green-500" />
                <span className="text-green-500">+{change.toFixed(1)}%</span>
              </>
            ) : change < 0 ? (
              <>
                <TrendingDown className="size-3 text-red-500" />
                <span className="text-red-500">{change.toFixed(1)}%</span>
              </>
            ) : (
              <>
                <Minus className="size-3 text-muted-foreground" />
                <span className="text-muted-foreground">0%</span>
              </>
            )}
            <span className="text-muted-foreground ml-1">vs 上週</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
