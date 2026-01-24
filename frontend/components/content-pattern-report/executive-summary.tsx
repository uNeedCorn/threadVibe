"use client";

import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["executive_summary"];
  snapshot: ContentPatternSnapshot;
}

const scoreConfig = {
  excellent: {
    label: "優秀",
    description: "內容策略清晰且有效",
    icon: TrendingUp,
    color: "text-emerald-600 dark:text-emerald-400",
    bgGradient: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    iconBg: "bg-emerald-500/20",
    borderColor: "border-emerald-500/30",
    ringColor: "ring-emerald-500/20",
    scoreBg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
  },
  good: {
    label: "良好",
    description: "內容策略穩定，持續優化",
    icon: TrendingUp,
    color: "text-blue-600 dark:text-blue-400",
    bgGradient: "from-blue-500/20 via-blue-500/10 to-transparent",
    iconBg: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
    ringColor: "ring-blue-500/20",
    scoreBg: "bg-gradient-to-br from-blue-500 to-blue-600",
  },
  average: {
    label: "待加強",
    description: "仍有進步空間",
    icon: Minus,
    color: "text-amber-600 dark:text-amber-400",
    bgGradient: "from-amber-500/20 via-amber-500/10 to-transparent",
    iconBg: "bg-amber-500/20",
    borderColor: "border-amber-500/30",
    ringColor: "ring-amber-500/20",
    scoreBg: "bg-gradient-to-br from-amber-500 to-amber-600",
  },
  needs_improvement: {
    label: "需改善",
    description: "建議調整內容方向",
    icon: TrendingDown,
    color: "text-rose-600 dark:text-rose-400",
    bgGradient: "from-rose-500/20 via-rose-500/10 to-transparent",
    iconBg: "bg-rose-500/20",
    borderColor: "border-rose-500/30",
    ringColor: "ring-rose-500/20",
    scoreBg: "bg-gradient-to-br from-rose-500 to-rose-600",
  },
};

function getScoreLevel(score: number): keyof typeof scoreConfig {
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
  const config = scoreConfig[level];
  const ScoreIcon = config.icon;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-2 shadow-lg",
        config.borderColor
      )}
    >
      {/* 背景漸層裝飾 */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50",
          config.bgGradient
        )}
      />

      <CardContent className="relative pt-6">
        {/* 頂部標題區 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">內容健康度報告</h2>
              <p className="text-[13px] text-muted-foreground">
                AI 分析您的內容模式與表現
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="px-3 py-1.5 text-xs font-medium"
          >
            {formatDateRange(snapshot.analysis_period.start, snapshot.analysis_period.end)}
            （{snapshot.analysis_period.total_posts} 篇）
          </Badge>
        </div>

        {/* 健康分數 + 一句話總結 */}
        <div
          className={cn(
            "flex items-center gap-5 p-5 rounded-2xl mb-6",
            "bg-gradient-to-r from-background/80 to-background/40",
            "border backdrop-blur-sm",
            config.borderColor
          )}
        >
          {/* 分數圓形 */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex flex-col items-center justify-center size-24 rounded-full text-white shadow-lg",
                config.scoreBg
              )}
            >
              <span className="text-3xl font-bold">{data.content_health_score}</span>
              <span className="text-xs opacity-90">/100</span>
            </div>
            <div
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium text-white",
                config.scoreBg
              )}
            >
              {config.label}
            </div>
          </div>

          {/* 摘要 */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <ScoreIcon className={cn("size-5", config.color)} />
              <span className={cn("font-semibold", config.color)}>
                {config.description}
              </span>
            </div>
            <p className="text-[15px] text-foreground/90 leading-relaxed">
              {data.headline}
            </p>
          </div>
        </div>

        {/* 關鍵發現 */}
        {data.key_findings.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-1.5 rounded-lg bg-amber-500/20">
                <Lightbulb className="size-4 text-amber-500" />
              </div>
              <h3 className="text-[15px] font-semibold">關鍵發現</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.key_findings.slice(0, 3).map((finding, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 size-6 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <p className="text-[14px] leading-relaxed">{finding}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 快速行動建議 */}
        {data.quick_wins.length > 0 && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-1.5 rounded-lg bg-emerald-500/20">
                <Zap className="size-4 text-emerald-500" />
              </div>
              <h3 className="text-[15px] font-semibold text-emerald-700 dark:text-emerald-300">
                快速行動
              </h3>
            </div>
            <ul className="space-y-3">
              {data.quick_wins.map((win, idx) => {
                const priority = idx === 0 ? "high" : idx === 1 ? "medium" : "low";
                const priorityConfig = {
                  high: {
                    label: "高",
                    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
                  },
                  medium: {
                    label: "中",
                    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                  },
                  low: {
                    label: "低",
                    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                  },
                };
                const pConfig = priorityConfig[priority];

                return (
                  <li key={idx} className="flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "flex-shrink-0 mt-0.5 px-2 py-0.5 text-[10px] font-semibold",
                        pConfig.color
                      )}
                    >
                      {pConfig.label}
                    </Badge>
                    <span className="text-[14px] text-foreground/90 leading-relaxed">
                      {win}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
