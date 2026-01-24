"use client";

import { Clock, Sparkles, Calendar, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["timing_analysis"];
  snapshot: ContentPatternSnapshot;
}

const DAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const DAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

// 所有 24 小時
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TimingSection({ data, snapshot }: Props) {
  const timing = snapshot.timing;

  // 建立熱力圖數據 - 直接使用每小時數據
  const heatmapData: Record<string, number> = {};
  const countData: Record<string, number> = {};

  timing.heatmap.forEach((item) => {
    const key = `${item.day}-${item.hour}`;
    heatmapData[key] = item.avg_engagement;
    countData[key] = item.count;
  });

  // 找出最大互動率用於顏色縮放
  const maxEngagement = Math.max(...Object.values(heatmapData), 0.01);

  const getHeatmapColor = (engagement: number) => {
    if (engagement === 0) return "bg-muted/30";
    const intensity = engagement / maxEngagement;
    if (intensity > 0.75) return "bg-emerald-500";
    if (intensity > 0.5) return "bg-emerald-400";
    if (intensity > 0.25) return "bg-emerald-300";
    return "bg-emerald-200";
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25">
            <Clock className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">發文時間效益</h2>
            <p className="text-[13px] text-muted-foreground">
              分析最佳發文時段
            </p>
          </div>
        </div>

        {/* 最佳時段摘要 */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {/* 最佳發文時段 */}
          <div className="rounded-2xl border bg-gradient-to-br from-orange-500/10 to-orange-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-orange-500/20">
                <Timer className="size-4 text-orange-500" />
              </div>
              <span className="text-[13px] font-medium text-muted-foreground">最佳時段</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.best_slots.map((slot, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-[12px] bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20"
                >
                  {slot}
                </Badge>
              ))}
            </div>
          </div>

          {/* 最佳發文日 */}
          <div className="rounded-2xl border bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-amber-500/20">
                <Calendar className="size-4 text-amber-500" />
              </div>
              <span className="text-[13px] font-medium text-muted-foreground">最佳發文日</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {timing.best_days.map((day, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-[12px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                >
                  {DAY_NAMES[day]}
                </Badge>
              ))}
            </div>
          </div>

          {/* 最佳發文時 */}
          <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/20">
                <Clock className="size-4 text-emerald-500" />
              </div>
              <span className="text-[13px] font-medium text-muted-foreground">最佳發文時</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {timing.best_hours.map((hour, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-[12px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                >
                  {hour}:00
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* 熱力圖 */}
        {timing.heatmap.length > 0 && (
          <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
            <h3 className="text-[14px] font-semibold mb-4">互動率熱力圖（每小時）</h3>
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[800px]">
                {/* 標題列 */}
                <div className="flex gap-0.5 mb-0.5">
                  <div className="w-8 flex-shrink-0" />
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex-1 min-w-[28px] text-muted-foreground text-center text-[10px] font-medium py-1"
                    >
                      {hour}
                    </div>
                  ))}
                </div>

                {/* 每天的數據 */}
                {DAY_SHORT.map((dayName, dayIdx) => (
                  <div key={`row-${dayIdx}`} className="flex gap-0.5 mb-0.5">
                    <div className="w-8 flex-shrink-0 text-muted-foreground text-right pr-1 py-1.5 text-[11px] font-medium">
                      {dayName}
                    </div>
                    {HOURS.map((hour) => {
                      const dataKey = `${dayIdx}-${hour}`;
                      const engagement = heatmapData[dataKey] || 0;
                      const count = countData[dataKey] || 0;

                      return (
                        <div
                          key={`cell-${dayIdx}-${hour}`}
                          className={cn(
                            "flex-1 min-w-[28px] rounded p-1.5 text-center text-[10px] font-medium transition-all hover:scale-105 cursor-default",
                            getHeatmapColor(engagement),
                            engagement > maxEngagement * 0.5 && "text-white"
                          )}
                          title={`${DAY_NAMES[dayIdx]} ${hour}:00 - ${count} 篇，互動率 ${(engagement * 100).toFixed(2)}%`}
                        >
                          {count > 0 ? count : ""}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* 圖例 */}
                <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-muted-foreground">
                  <span>互動率：</span>
                  <div className="flex items-center gap-1">
                    <div className="size-4 rounded bg-muted/30 border"></div>
                    <span>無數據</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="size-4 rounded bg-emerald-200"></div>
                    <span>低</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="size-4 rounded bg-emerald-400"></div>
                    <span>中</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="size-4 rounded bg-emerald-500"></div>
                    <span>高</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI 分析區 */}
        <div className="mt-6 rounded-2xl border bg-gradient-to-br from-orange-500/5 to-transparent p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-orange-500/10">
              <Sparkles className="size-4 text-orange-500" />
            </div>
            <h3 className="text-[14px] font-semibold">AI 分析</h3>
          </div>
          <p className="text-[14px] leading-relaxed mb-3">{data.summary}</p>
          <ul className="space-y-2">
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px]">
                <span className="flex-shrink-0 size-1.5 rounded-full bg-orange-500 mt-2" />
                <span className="text-muted-foreground">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
