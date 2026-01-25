"use client";

import { Share2, Lightbulb, Sparkles, TrendingUp, Repeat2, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing } from "@/components/report-shared";
import type { DataSnapshot } from "@/hooks/use-weekly-report";

interface ViralityAnalysisData {
  summary: string;
  findings?: string[];
  insights?: string[];
  recommendations?: string[];
}

interface Props {
  data: ViralityAnalysisData;
  snapshot: DataSnapshot;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(num: number): string {
  return `${(num * 100).toFixed(2)}%`;
}

export function ViralityAnalysisSection({ data, snapshot }: Props) {
  const findings = data.findings || data.insights || [];

  const { virality_metrics, summary, previous_week } = snapshot;

  const viralityChange = previous_week?.avg_virality_score
    ? ((virality_metrics.avg_virality_score - previous_week.avg_virality_score) /
        previous_week.avg_virality_score) * 100
    : null;

  const metrics = [
    {
      label: "傳播力分數",
      value: formatPercent(virality_metrics.avg_virality_score),
      description: "轉發+引用 / 曝光",
      change: viralityChange,
      icon: Share2,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
    {
      label: "高傳播貼文",
      value: `${virality_metrics.high_virality_posts} 篇`,
      description: "傳播力 > 1%",
      icon: TrendingUp,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "總轉發數",
      value: formatNumber(summary.total_reposts),
      description: "被他人轉發",
      icon: Repeat2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "總引用數",
      value: formatNumber(summary.total_quotes),
      description: "被他人引用",
      icon: Quote,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.rose)}>
            <Share2 className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>傳播力分析</h2>
            <p className={typography.caption}>內容擴散與破圈能力</p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative rounded-xl border-2 border-rose-200 bg-rose-50/50 p-5">
          <Sparkles className="absolute top-4 right-4 size-4 text-rose-400/50" />
          <p className={cn(typography.body, "pr-8")}>{data.summary}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 傳播力指標 */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className={cn(typography.sectionTitle, "mb-4")}>傳播力指標</h3>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((metric, idx) => {
                const Icon = metric.icon;
                return (
                  <div key={idx} className="p-3 rounded-xl border bg-background">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("p-1.5 rounded-lg", metric.bgColor)}>
                        <Icon className={cn("size-3.5", metric.color)} />
                      </div>
                      <span className={cn(typography.label, "text-muted-foreground normal-case")}>
                        {metric.label}
                      </span>
                    </div>
                    <div className={cn("text-lg font-bold", typography.number)}>{metric.value}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{metric.description}</span>
                      {metric.change !== undefined && metric.change !== null && (
                        <span className={cn(
                          "text-xs font-medium",
                          metric.change >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {metric.change >= 0 ? "+" : ""}{metric.change.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI 發現 */}
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="size-5 text-amber-600" />
              <h3 className={cn(typography.sectionTitle, "text-amber-700")}>AI 發現</h3>
            </div>
            <ul className={spacing.list}>
              {findings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="shrink-0 size-1.5 rounded-full bg-rose-500 mt-2" />
                  <span className={typography.body}>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
