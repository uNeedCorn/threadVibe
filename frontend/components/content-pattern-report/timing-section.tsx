"use client";

import { Clock, Sparkles, Calendar, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing, semanticColors } from "@/components/report-shared";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["timing_analysis"];
  snapshot: ContentPatternSnapshot;
}

const DAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const DAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TimingSection({ data, snapshot }: Props) {
  const timing = snapshot.timing;

  const heatmapData: Record<string, number> = {};
  const countData: Record<string, number> = {};

  timing.heatmap.forEach((item) => {
    const key = `${item.day}-${item.hour}`;
    heatmapData[key] = item.avg_engagement;
    countData[key] = item.count;
  });

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
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.amber)}>
            <Clock className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>發文時間效益</h2>
            <p className={typography.caption}>分析最佳發文時段</p>
          </div>
        </div>

        {/* 最佳時段摘要 */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* 最佳發文時段 */}
          <div className="rounded-xl border-2 border-orange-200 bg-orange-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="size-5 text-orange-600" />
              <span className={cn(typography.caption, "font-medium")}>最佳時段</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.best_slots.map((slot, i) => (
                <Badge key={i} className="bg-orange-500/10 text-orange-700 border-orange-500/20">{slot}</Badge>
              ))}
            </div>
          </div>

          {/* 最佳發文日 */}
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="size-5 text-amber-600" />
              <span className={cn(typography.caption, "font-medium")}>最佳發文日</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {timing.best_days.map((day, i) => (
                <Badge key={i} className={semanticColors.warning.badge}>{DAY_NAMES[day]}</Badge>
              ))}
            </div>
          </div>

          {/* 最佳發文時 */}
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="size-5 text-emerald-600" />
              <span className={cn(typography.caption, "font-medium")}>最佳發文時</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {timing.best_hours.map((hour, i) => (
                <Badge key={i} className={semanticColors.success.badge}>{hour}:00</Badge>
              ))}
            </div>
          </div>
        </div>

        {/* 熱力圖 */}
        {timing.heatmap.length > 0 && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className={cn(typography.sectionTitle, "mb-4")}>互動率熱力圖（每小時）</h3>
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[800px]">
                <div className="flex gap-0.5 mb-0.5">
                  <div className="w-8 shrink-0" />
                  {HOURS.map((hour) => (
                    <div key={hour} className="flex-1 min-w-[28px] text-muted-foreground text-center text-[10px] font-medium py-1">
                      {hour}
                    </div>
                  ))}
                </div>

                {DAY_SHORT.map((dayName, dayIdx) => (
                  <div key={`row-${dayIdx}`} className="flex gap-0.5 mb-0.5">
                    <div className="w-8 shrink-0 text-muted-foreground text-right pr-1 py-1.5 text-xs font-medium">
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

                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span>互動率：</span>
                  <div className="flex items-center gap-1"><div className="size-4 rounded bg-muted/30 border"></div><span>無數據</span></div>
                  <div className="flex items-center gap-1"><div className="size-4 rounded bg-emerald-200"></div><span>低</span></div>
                  <div className="flex items-center gap-1"><div className="size-4 rounded bg-emerald-400"></div><span>中</span></div>
                  <div className="flex items-center gap-1"><div className="size-4 rounded bg-emerald-500"></div><span>高</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI 分析區 */}
        <section className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-5 text-amber-600" />
            <h3 className={cn(typography.sectionTitle, "text-amber-700")}>AI 分析</h3>
          </div>
          <p className={cn(typography.body, "mb-3")}>{data.summary}</p>
          <ul className={spacing.listCompact}>
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 size-1.5 rounded-full bg-orange-500 mt-2" />
                <span className={typography.caption}>{insight}</span>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
