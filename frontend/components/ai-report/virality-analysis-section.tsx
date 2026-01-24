"use client";

import {
  Share2,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Repeat2,
  Quote,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DataSnapshot } from "@/hooks/use-weekly-report";

interface ViralityAnalysisData {
  summary: string;
  findings?: string[];
  // 向後相容舊格式
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
  // 向後相容：優先使用 findings，fallback 到 insights
  const findings = data.findings || data.insights || [];

  const { virality_metrics, summary, previous_week } = snapshot;

  const viralityChange = previous_week?.avg_virality_score
    ? ((virality_metrics.avg_virality_score -
        previous_week.avg_virality_score) /
        previous_week.avg_virality_score) *
      100
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
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg shadow-rose-500/25">
            <Share2 className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">傳播力分析</h2>
            <p className="text-[13px] text-muted-foreground">
              內容擴散與破圈能力
            </p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20">
          <div className="absolute top-3 right-3">
            <Sparkles className="size-4 text-rose-500/50" />
          </div>
          <p className="text-[14px] leading-relaxed pr-8">{data.summary}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 傳播力指標 */}
          <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
            <h3 className="mb-4 text-[14px] font-medium">傳播力指標</h3>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((metric, idx) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border bg-gradient-to-br from-background to-muted/30"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("p-1.5 rounded-lg", metric.bgColor)}>
                        <Icon className={cn("size-3.5", metric.color)} />
                      </div>
                      <span className="text-[12px] font-medium text-muted-foreground">
                        {metric.label}
                      </span>
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {metric.value}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {metric.description}
                      </span>
                      {metric.change !== undefined && metric.change !== null && (
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            metric.change >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                          )}
                        >
                          {metric.change >= 0 ? "+" : ""}
                          {metric.change.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI 發現 */}
          <div className="rounded-2xl border bg-gradient-to-br from-amber-500/5 to-transparent p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Lightbulb className="size-4 text-amber-500" />
              </div>
              <h3 className="text-[14px] font-semibold">AI 發現</h3>
            </div>
            <ul className="space-y-2.5">
              {findings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 size-1.5 rounded-full bg-rose-500 mt-2" />
                  <span className="text-[14px] text-foreground/90 leading-relaxed">
                    {finding}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
