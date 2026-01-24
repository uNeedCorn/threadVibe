"use client";

import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const ratingConfig = {
  excellent: {
    label: "表現優異",
    description: "本週表現卓越，持續保持！",
    icon: TrendingUp,
    color: "text-emerald-600 dark:text-emerald-400",
    bgGradient: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    iconBg: "bg-emerald-500/20",
    borderColor: "border-emerald-500/30",
    ringColor: "ring-emerald-500/20",
  },
  good: {
    label: "表現良好",
    description: "本週表現穩定，繼續努力！",
    icon: TrendingUp,
    color: "text-blue-600 dark:text-blue-400",
    bgGradient: "from-blue-500/20 via-blue-500/10 to-transparent",
    iconBg: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
    ringColor: "ring-blue-500/20",
  },
  average: {
    label: "表現普通",
    description: "本週表現平穩，仍有進步空間",
    icon: Minus,
    color: "text-amber-600 dark:text-amber-400",
    bgGradient: "from-amber-500/20 via-amber-500/10 to-transparent",
    iconBg: "bg-amber-500/20",
    borderColor: "border-amber-500/30",
    ringColor: "ring-amber-500/20",
  },
  needs_improvement: {
    label: "待加強",
    description: "本週需要更多努力，加油！",
    icon: TrendingDown,
    color: "text-rose-600 dark:text-rose-400",
    bgGradient: "from-rose-500/20 via-rose-500/10 to-transparent",
    iconBg: "bg-rose-500/20",
    borderColor: "border-rose-500/30",
    ringColor: "ring-rose-500/20",
  },
};

const priorityConfig = {
  high: {
    label: "高",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    icon: AlertCircle,
  },
  medium: {
    label: "中",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: Target,
  },
  low: {
    label: "低",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    icon: ArrowRight,
  },
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
  const config = ratingConfig[data.overall_rating];
  const RatingIcon = config.icon;

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
              <h2 className="text-lg font-semibold tracking-tight">週報摘要</h2>
              <p className="text-[13px] text-muted-foreground">
                AI 為您分析本週表現
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="px-3 py-1.5 text-xs font-medium"
          >
            {formatDateRange(period.start, period.end)}
          </Badge>
        </div>

        {/* 整體評分與一句話總結 */}
        <div
          className={cn(
            "flex items-center gap-5 p-5 rounded-2xl mb-6",
            "bg-gradient-to-r from-background/80 to-background/40",
            "border backdrop-blur-sm",
            config.borderColor
          )}
        >
          <div
            className={cn(
              "flex-shrink-0 p-4 rounded-2xl ring-4",
              config.iconBg,
              config.ringColor
            )}
          >
            <RatingIcon
              className={cn("size-10", config.color)}
              strokeWidth={2.5}
            />
          </div>
          <div className="space-y-1 flex-1">
            <div className={cn("text-2xl font-bold tracking-tight", config.color)}>
              {config.label}
            </div>
            <div className="text-[14px] text-foreground/80 leading-relaxed">
              {data.one_line_summary}
            </div>
          </div>
        </div>

        {/* 關鍵數字 */}
        {data.key_metrics && data.key_metrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {data.key_metrics.map((metric, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-muted/30 border border-border/50"
              >
                <div className="text-[12px] text-muted-foreground mb-1">
                  {metric.label}
                </div>
                <div className="text-xl font-bold">{metric.value}</div>
                {metric.change && (
                  <div
                    className={cn(
                      "text-[12px] font-medium mt-0.5",
                      metric.change.startsWith("+")
                        ? "text-emerald-500"
                        : metric.change.startsWith("-")
                        ? "text-rose-500"
                        : "text-muted-foreground"
                    )}
                  >
                    {metric.change}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 行動建議 */}
        {data.action_items && data.action_items.length > 0 && (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-transparent border border-emerald-500/20">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-1.5 rounded-lg bg-emerald-500/20">
                <Target className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-[15px] font-semibold text-emerald-700 dark:text-emerald-300">
                下週行動建議
              </h3>
            </div>
            <ul className="space-y-4">
              {data.action_items.map((item, idx) => {
                const priorityCfg = priorityConfig[item.priority];
                return (
                  <li key={idx} className="flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "flex-shrink-0 mt-0.5 px-2 py-0.5 text-[10px] font-semibold",
                        priorityCfg.color
                      )}
                    >
                      {priorityCfg.label}
                    </Badge>
                    <div className="flex-1">
                      <div className="text-[14px] font-medium text-foreground/90 leading-relaxed">
                        {item.action}
                      </div>
                      <div className="text-[13px] text-muted-foreground mt-1">
                        {item.reason}
                      </div>
                    </div>
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
