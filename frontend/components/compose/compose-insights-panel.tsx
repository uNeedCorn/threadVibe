"use client";

import { useMemo } from "react";
import {
  TrendingUp,
  Clock,
  BarChart3,
  Zap,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TagStats {
  id: string;
  name: string;
  color: string;
  postCount: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  engagementRate: number;
  peakHour: number;
  lifecyclePeak: string; // e.g., "24hr"
}

interface ComposeInsightsPanelProps {
  selectedTagIds: string[];
  accountTags: Array<{ id: string; name: string; color: string }>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// Mock data - 實際使用時從 API 獲取
const mockTagStats: Record<string, TagStats> = {
  // 可以根據實際 tag ID 動態載入
};

// 格式化數字
function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

// 生命週期曲線 SVG
function LifecycleCurve({ peak = "24hr" }: { peak?: string }) {
  return (
    <div className="relative h-12 w-full">
      <svg
        viewBox="0 0 100 40"
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        {/* 背景網格 */}
        <line x1="0" y1="30" x2="100" y2="30" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="2" />
        <line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="2" />
        <line x1="0" y1="10" x2="100" y2="10" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="2" />

        {/* 曲線 */}
        <path
          d="M 0 35 Q 15 35, 25 15 Q 35 5, 50 10 Q 65 15, 80 25 Q 95 32, 100 33"
          fill="none"
          stroke="url(#curveGradient)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* 高峰點標記 */}
        <circle cx="35" cy="8" r="3" fill="var(--primary)" />

        {/* 漸層定義 */}
        <defs>
          <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
            <stop offset="35%" stopColor="var(--primary)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>

      {/* 高峰標籤 */}
      <div className="absolute left-[35%] top-0 -translate-x-1/2">
        <span className="text-[10px] font-medium text-primary">{peak}</span>
      </div>

      {/* 時間軸標籤 */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-muted-foreground">
        <span>0h</span>
        <span>24h</span>
        <span>48h</span>
        <span>72h</span>
      </div>
    </div>
  );
}

// 時間熱力圖
function TimeHeatmap({ peakHour = 20 }: { peakHour?: number }) {
  const hours = [9, 12, 15, 18, 20, 21, 22];

  return (
    <div className="flex items-center gap-1">
      {hours.map((hour) => {
        const intensity = hour === peakHour ? 1 : Math.random() * 0.6 + 0.1;
        const isPeak = hour === peakHour;

        return (
          <Tooltip key={hour}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-medium transition-all cursor-default",
                  isPeak
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                    : "bg-primary/10 text-primary"
                )}
                style={{ opacity: isPeak ? 1 : intensity }}
              >
                {hour}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {hour}:00 {isPeak && "- 最佳時段"}
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
  isCollapsed,
  onToggleCollapse,
}: ComposeInsightsPanelProps) {
  // 獲取選中標籤的統計數據
  const selectedTagsWithStats = useMemo(() => {
    return selectedTagIds
      .map((id) => {
        const tag = accountTags.find((t) => t.id === id);
        if (!tag) return null;

        // Mock stats - 實際使用時從 API 獲取
        const stats: TagStats = mockTagStats[id] || {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          postCount: Math.floor(Math.random() * 20) + 5,
          avgViews: Math.floor(Math.random() * 3000) + 500,
          avgLikes: Math.floor(Math.random() * 200) + 20,
          avgReplies: Math.floor(Math.random() * 30) + 5,
          engagementRate: Math.random() * 8 + 2,
          peakHour: [9, 12, 18, 20, 21][Math.floor(Math.random() * 5)],
          lifecyclePeak: ["12hr", "24hr", "36hr", "48hr"][Math.floor(Math.random() * 4)],
        };

        return stats;
      })
      .filter(Boolean) as TagStats[];
  }, [selectedTagIds, accountTags]);

  // 計算綜合建議時間
  const suggestedTime = useMemo(() => {
    if (selectedTagsWithStats.length === 0) return null;

    const avgPeakHour = Math.round(
      selectedTagsWithStats.reduce((sum, t) => sum + t.peakHour, 0) /
        selectedTagsWithStats.length
    );

    return {
      hour: avgPeakHour,
      label: `${avgPeakHour}:00`,
      dayLabel: "今天",
    };
  }, [selectedTagsWithStats]);

  // 收合狀態下的迷你視圖
  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className={cn(
          "flex h-full w-10 flex-col items-center justify-center gap-3 border-l",
          "bg-gradient-to-b from-muted/30 to-muted/50",
          "hover:bg-muted/60 transition-colors"
        )}
      >
        <ChevronRight className="size-4 text-muted-foreground rotate-180" />
        <div className="flex flex-col items-center gap-2 [writing-mode:vertical-lr]">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">
            決策輔助
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="flex h-full w-80 flex-col border-l bg-gradient-to-b from-card to-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">決策輔助</h3>
            <p className="text-[11px] text-muted-foreground">
              根據歷史數據提供建議
            </p>
          </div>
        </div>
        <button
          onClick={onToggleCollapse}
          className="flex size-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
        >
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {selectedTagsWithStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              選擇貼文標籤
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              查看該類貼文的歷史成效
            </p>
          </div>
        ) : (
          <>
            {/* 標籤成效摘要 */}
            {selectedTagsWithStats.map((tag) => (
              <div
                key={tag.id}
                className="rounded-xl border bg-card p-4 space-y-4"
              >
                {/* 標籤標題 */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${tag.color}15`,
                      color: tag.color,
                      borderColor: `${tag.color}30`,
                    }}
                  >
                    {tag.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    過去 {tag.postCount} 篇
                  </span>
                </div>

                {/* 成效指標 */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-lg font-semibold tabular-nums">
                      {formatNumber(tag.avgViews)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      平均觸及
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold tabular-nums">
                      {formatNumber(tag.avgLikes)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      平均愛心
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold tabular-nums text-primary">
                      {tag.engagementRate.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      互動率
                    </p>
                  </div>
                </div>

                {/* 生命週期曲線 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="size-3.5" />
                    <span>成效生命週期</span>
                  </div>
                  <LifecycleCurve peak={tag.lifecyclePeak} />
                  <p className="text-[11px] text-muted-foreground text-center">
                    約 <span className="font-medium text-foreground">{tag.lifecyclePeak}</span> 達到 80% 成效
                  </p>
                </div>
              </div>
            ))}

            {/* 最佳發文時間建議 */}
            {suggestedTime && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-primary/20">
                    <Zap className="size-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">建議發文時間</span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums">
                    {suggestedTime.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {suggestedTime.dayLabel}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">
                    粉絲活躍時段分布
                  </p>
                  <TimeHeatmap peakHour={suggestedTime.hour} />
                </div>
              </div>
            )}

            {/* 小提示 */}
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <Clock className="mt-0.5 size-3.5 text-muted-foreground shrink-0" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                數據基於過去 30 天的貼文表現。選擇多個標籤時，會綜合計算建議時間。
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
