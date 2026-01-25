"use client";

import { Sparkles, TrendingUp, TrendingDown, Minus, Target, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ratingStyles, priorityStyles, iconGradients, typography, spacing } from "@/components/report-shared";

interface ActionItem {
  action: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

interface KeyMetric {
  label: string;
  value: string;
  change?: string;
}

interface ExecutiveSummaryData {
  overall_rating: "excellent" | "good" | "average" | "needs_improvement";
  one_line_summary: string;
  key_metrics: KeyMetric[];
  action_items: ActionItem[];
}

interface Props {
  data: ExecutiveSummaryData;
  period: {
    start: string;
    end: string;
  };
}

const ratingIcons = {
  excellent: TrendingUp,
  good: TrendingUp,
  average: Minus,
  needs_improvement: TrendingDown,
};

const ratingDescriptions = {
  excellent: "本期表現卓越，持續保持！",
  good: "本期表現穩定，繼續努力！",
  average: "本期表現平穩，仍有進步空間",
  needs_improvement: "本期需要更多努力，加油！",
};

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  const formatDate = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`;

  return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
}

export function ExecutiveSummarySection({ data, period }: Props) {
  const config = ratingStyles[data.overall_rating];
  const RatingIcon = ratingIcons[data.overall_rating];

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
              <h2 className={typography.cardTitle}>洞察摘要</h2>
              <p className={typography.caption}>AI 為您分析本期表現</p>
            </div>
          </div>
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-medium">
            {formatDateRange(period.start, period.end)}
          </Badge>
        </div>

        {/* 評分與摘要 */}
        <div className={cn(
          "flex items-center gap-5 p-5 rounded-xl border-2 bg-background/60 backdrop-blur-sm",
          config.border
        )}>
          <div className={cn("shrink-0 p-4 rounded-2xl ring-4", config.iconBg, config.ring)}>
            <RatingIcon className={cn("size-10", config.text)} strokeWidth={2.5} />
          </div>
          <div className="space-y-1 flex-1">
            <div className={cn("text-2xl font-bold", config.text)}>{config.label}</div>
            <p className={typography.body}>{data.one_line_summary}</p>
          </div>
        </div>

        {/* 關鍵數字 */}
        {data.key_metrics?.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.key_metrics.map((metric, idx) => (
              <div key={idx} className="rounded-xl border bg-muted/30 p-4">
                <p className={cn(typography.label, "text-muted-foreground mb-1")}>{metric.label}</p>
                <p className={cn(typography.bigNumber)}>{metric.value}</p>
                {metric.change && (
                  <p className={cn(
                    "text-xs font-medium mt-1",
                    metric.change.startsWith("+") ? "text-emerald-600" :
                    metric.change.startsWith("-") ? "text-rose-600" : "text-muted-foreground"
                  )}>
                    {metric.change}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 行動建議 */}
        {data.action_items?.length > 0 && (
          <section className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="size-5 text-emerald-600" />
              <h3 className={cn(typography.sectionTitle, "text-emerald-700")}>下週行動建議</h3>
            </div>
            <ul className={spacing.list}>
              {data.action_items.map((item, idx) => {
                const pStyle = priorityStyles[item.priority];
                return (
                  <li key={idx} className="flex items-start gap-3">
                    <Badge variant="outline" className={cn("shrink-0 mt-0.5 px-2 py-0.5 text-xs font-semibold", pStyle.badge)}>
                      {pStyle.label}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className={cn(typography.caption, "mt-1")}>{item.reason}</p>
                    </div>
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
