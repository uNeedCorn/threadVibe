"use client";

import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeleton 預設配置
 * 確保 loading 狀態的尺寸與實際內容匹配
 */

interface SkeletonTextProps {
  /** 文字行數 */
  lines?: number;
  /** 寬度變化（讓多行文字更自然） */
  varying?: boolean;
  className?: string;
}

/** 文字 Skeleton（支援多行） */
export function SkeletonText({ lines = 1, varying = true, className }: SkeletonTextProps) {
  const widths = varying
    ? ["w-full", "w-11/12", "w-4/5", "w-3/4", "w-2/3"]
    : ["w-full"];

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", widths[i % widths.length])}
        />
      ))}
    </div>
  );
}

/** KPI 卡片標題 Skeleton */
export function SkeletonKPITitle({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-20", className)} />;
}

/** KPI 卡片數值 Skeleton */
export function SkeletonKPIValue({ className }: { className?: string }) {
  return <Skeleton className={cn("h-8 w-24", className)} />;
}

/** KPI 卡片 Badge Skeleton */
export function SkeletonKPIBadge({ className }: { className?: string }) {
  return <Skeleton className={cn("h-5 w-16 rounded-full", className)} />;
}

/** 圖表標題 Skeleton */
export function SkeletonChartTitle({ className }: { className?: string }) {
  return <Skeleton className={cn("h-5 w-32", className)} />;
}

/** 圖表區域 Skeleton */
export function SkeletonChart({
  height = 200,
  className
}: {
  height?: number;
  className?: string
}) {
  return <Skeleton className={cn("w-full rounded-lg", className)} style={{ height }} />;
}

/** 頭像 Skeleton */
export function SkeletonAvatar({
  size = "md",
  className
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string
}) {
  const sizeClasses = {
    sm: "size-6",
    md: "size-8",
    lg: "size-10",
    xl: "size-16",
  };

  return (
    <Skeleton className={cn("rounded-full", sizeClasses[size], className)} />
  );
}

/** 表格行 Skeleton */
export function SkeletonTableRow({
  columns = 4,
  className
}: {
  columns?: number;
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-4 py-3", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === 0 ? "w-12" : i === columns - 1 ? "w-16" : "flex-1"
          )}
        />
      ))}
    </div>
  );
}

/** 貼文卡片 Skeleton */
export function SkeletonPostCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border p-4 space-y-3", className)}>
      {/* Header: Avatar + Username */}
      <div className="flex items-center gap-3">
        <SkeletonAvatar size="md" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      {/* Content */}
      <SkeletonText lines={2} />
      {/* Metrics */}
      <div className="flex gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

/** 簡易 KPI 卡片 Skeleton（配合 variant="simple" 的 KPICard） */
export function SkeletonKPICardSimple({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <div className="flex items-center justify-between pb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-4" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="mt-1 h-3 w-16" />
    </div>
  );
}

/** 完整 KPI 卡片 Skeleton（配合預設 variant 的 KPICard） */
export function SkeletonKPICardFull({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border p-5", className)}>
      <div className="flex items-center justify-between pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-10 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-28 mb-3" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}
