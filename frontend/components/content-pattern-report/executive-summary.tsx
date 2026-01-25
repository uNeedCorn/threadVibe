"use client";

import { Sparkles, TrendingUp, TrendingDown, Minus, Lightbulb, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing, ratingStyles, priorityStyles, getScoreStyle } from "@/components/report-shared";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["executive_summary"];
  snapshot: ContentPatternSnapshot;
}

const ratingIcons = {
  excellent: TrendingUp,
  good: TrendingUp,
  average: Minus,
  needs_improvement: TrendingDown,
};

function getScoreLevel(score: number): keyof typeof ratingStyles {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "average";
  return "needs_improvement";
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${format(startDate)} ~ ${format(endDate)}`;
}

export function ExecutiveSummarySection({ data, snapshot }: Props) {
  const level = getScoreLevel(data.content_health_score);
  const config = ratingStyles[level];
  const scoreStyle = getScoreStyle(data.content_health_score);
  const ScoreIcon = ratingIcons[level];

  return (
    <Card className={cn("relative overflow-hidden border-2", config.borderStrong)}>
      {/* 背景漸層 */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", config.gradient)} />

      <CardContent className="relative pt-6 space-y-6">
        {/* 頂部標題區 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", iconGradients.purple)}>
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <h2 className={typography.cardTitle}>內容健康度報告</h2>
              <p className={typography.caption}>AI 分析您的內容模式與表現</p>
            </div>
          </div>
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-medium">
            {formatDateRange(snapshot.analysis_period.start, snapshot.analysis_period.end)}
            （{snapshot.analysis_period.total_posts} 篇）
          </Badge>
        </div>

        {/* 健康分數 + 摘要 */}
        <div className={cn(
          "flex items-center gap-5 p-5 rounded-xl border-2 bg-background/60 backdrop-blur-sm",
          config.border
        )}>
          {/* 分數圓形 */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div className={cn("flex flex-col items-center justify-center size-24 rounded-full text-white shadow-lg", config.scoreBg)}>
              <span className="text-3xl font-bold">{data.content_health_score}</span>
              <span className="text-xs opacity-90">/100</span>
            </div>
            <Badge className={cn("px-2.5 py-1 text-xs font-medium text-white border-0", config.scoreBg)}>
              {scoreStyle.label}
            </Badge>
          </div>

          {/* 摘要 */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <ScoreIcon className={cn("size-5", config.text)} />
              <span className={cn("font-semibold", config.text)}>內容策略{scoreStyle.label}</span>
            </div>
            <p className={typography.body}>{data.headline}</p>
          </div>
        </div>

        {/* 關鍵發現 */}
        {data.key_findings.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="size-5 text-amber-600" />
              <h3 className={cn(typography.sectionTitle, "text-amber-700")}>關鍵發現</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.key_findings.slice(0, 3).map((finding, idx) => (
                <div key={idx} className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 hover:border-amber-300 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 size-6 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-600 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <p className={typography.body}>{finding}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 快速行動建議 */}
        {data.quick_wins.length > 0 && (
          <section className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="size-5 text-emerald-600" />
              <h3 className={cn(typography.sectionTitle, "text-emerald-700")}>快速行動</h3>
            </div>
            <ul className={spacing.list}>
              {data.quick_wins.map((win, idx) => {
                const priority = idx === 0 ? "high" : idx === 1 ? "medium" : "low";
                const pStyle = priorityStyles[priority];
                return (
                  <li key={idx} className="flex items-start gap-3">
                    <Badge variant="outline" className={cn("shrink-0 mt-0.5 px-2 py-0.5 text-xs font-semibold", pStyle.badge)}>
                      {pStyle.label}
                    </Badge>
                    <span className={typography.body}>{win}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
