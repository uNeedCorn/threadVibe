"use client";

import { useMemo, useEffect } from "react";
import {
  TrendingUp,
  Clock,
  BarChart3,
  Zap,
  PanelRightClose,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTagStats, type TagStats } from "@/hooks/use-tag-stats";

interface ComposeInsightsPanelProps {
  selectedTagIds: string[];
  accountTags: Array<{ id: string; name: string; color: string }>;
  accountId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSuggestedHourChange?: (hour: number | null) => void;
}

// 格式化數字
function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

// 迷你生命週期曲線
function MiniLifecycleCurve({ peak = "24hr" }: { peak?: string }) {
  return (
    <div className="relative h-8 w-full">
      <svg
        viewBox="0 0 100 32"
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 28 Q 20 28, 30 12 Q 40 4, 55 8 Q 70 12, 85 20 Q 95 26, 100 27"
          fill="url(#areaGradient)"
          opacity="0.3"
        />
        <path
          d="M 0 28 Q 20 28, 30 12 Q 40 4, 55 8 Q 70 12, 85 20 Q 95 26, 100 27"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="40" cy="6" r="3" fill="var(--primary)" />
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute left-[40%] -top-1 -translate-x-1/2">
        <span className="text-[9px] font-semibold text-primary bg-background px-1 rounded">{peak}</span>
      </div>
    </div>
  );
}

// 時間熱力圖（簡化版）
function TimeHeatmap({ peakHour = 20 }: { peakHour?: number }) {
  const hours = [9, 12, 15, 18, 20, 21];

  return (
    <div className="flex items-center gap-0.5">
      {hours.map((hour) => {
        const isPeak = hour === peakHour;
        const intensity = isPeak ? 1 : 0.15 + Math.random() * 0.35;

        return (
          <Tooltip key={hour}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "h-5 flex-1 rounded-sm flex items-center justify-center text-[9px] font-medium cursor-default transition-all",
                  isPeak && "ring-1 ring-primary"
                )}
                style={{
                  backgroundColor: `oklch(var(--primary) / ${intensity})`,
                  color: isPeak ? "var(--primary-foreground)" : "var(--primary)",
                }}
              >
                {hour}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs px-2 py-1">
              {hour}:00 {isPeak && "⚡ 最佳"}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function ComposeInsightsPanel({
  selectedTagIds,
  accountTags,
  accountId,
  isCollapsed,
  onToggleCollapse,
  onSuggestedHourChange,
}: ComposeInsightsPanelProps) {
  // 從 API 獲取選中標籤的統計數據
  const { stats: tagStats, isLoading } = useTagStats({
    tagIds: selectedTagIds,
    accountId,
  });

  // 合併標籤基本資料與統計數據
  const selectedTagsWithStats = useMemo(() => {
    return tagStats.map((stat) => {
      const tag = accountTags.find((t) => t.id === stat.id);
      return {
        ...stat,
        // 確保使用最新的標籤名稱和顏色
        name: tag?.name || stat.name,
        color: tag?.color || stat.color,
      };
    });
  }, [tagStats, accountTags]);

  // 計算綜合建議時間
  const suggestedTime = useMemo(() => {
    const validStats = selectedTagsWithStats.filter((t) => t.peakHour !== null);
    if (validStats.length === 0) return null;

    const avgPeakHour = Math.round(
      validStats.reduce((sum, t) => sum + (t.peakHour || 0), 0) /
        validStats.length
    );

    return {
      hour: avgPeakHour,
      label: `${avgPeakHour}:00`,
    };
  }, [selectedTagsWithStats]);

  // 通知父組件建議時間變更
  useEffect(() => {
    onSuggestedHourChange?.(suggestedTime?.hour ?? null);
  }, [suggestedTime?.hour, onSuggestedHourChange]);

  // 收合狀態
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggleCollapse}
            className="flex h-full w-10 items-center justify-center border-l bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <Sparkles className="size-4 text-primary" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">展開決策輔助</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex h-full w-72 flex-col border-l bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-semibold">決策輔助</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onToggleCollapse}
            >
              <PanelRightClose className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">收合面板</TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="size-6 text-primary animate-spin mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              載入數據中...
            </p>
          </div>
        ) : selectedTagsWithStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              選擇貼文標籤
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              查看歷史成效數據
            </p>
          </div>
        ) : (
          <>
            {/* 標籤成效卡片 */}
            {selectedTagsWithStats.map((tag) => (
              <div
                key={tag.id}
                className="rounded-lg border bg-card p-3 space-y-3"
              >
                {/* 標籤 Header */}
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className="px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {tag.postCount} 篇
                  </span>
                </div>

                {/* 成效指標 */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatNumber(tag.avgViews)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">觸及</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatNumber(tag.avgLikes)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">愛心</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-primary">
                      {tag.engagementRate.toFixed(1)}%
                    </p>
                    <p className="text-[9px] text-muted-foreground">互動率</p>
                  </div>
                </div>

                {/* 生命週期 */}
                {tag.lifecyclePeak && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <TrendingUp className="size-3" />
                      <span>成效週期</span>
                    </div>
                    <MiniLifecycleCurve peak={tag.lifecyclePeak} />
                  </div>
                )}
              </div>
            ))}

            {/* 建議時間卡片 */}
            {suggestedTime && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="size-3.5 text-primary" />
                  <span className="text-xs font-medium">建議發文時間</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums text-primary">
                    {suggestedTime.label}
                  </span>
                  <span className="text-xs text-muted-foreground">今天</span>
                </div>
                <TimeHeatmap peakHour={suggestedTime.hour} />
              </div>
            )}

            {/* 提示 */}
            <p className="text-[10px] text-muted-foreground/60 text-center pt-2">
              <Clock className="inline size-3 mr-1" />
              數據基於過去 30 天表現
            </p>
          </>
        )}
      </div>
    </div>
  );
}
