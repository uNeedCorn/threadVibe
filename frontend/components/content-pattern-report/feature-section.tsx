"use client";

import { Sparkles, Smile, Hash, Link2, HelpCircle, Megaphone, Check, X, TrendingUp, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["feature_analysis"];
  snapshot: ContentPatternSnapshot;
}

interface FeatureCardProps {
  title: string;
  icon: React.ElementType;
  withStats: { count: number; avg_views: number };
  withoutStats: { count: number; avg_views: number };
  insight: string;
  recommendation: string;
  optimalCount?: number | null;
  bestType?: string | null;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function FeatureCard({
  title,
  icon: Icon,
  withStats,
  withoutStats,
  insight,
  recommendation,
  optimalCount,
  bestType,
}: FeatureCardProps) {
  const withBetter = withStats.avg_views > withoutStats.avg_views;
  const diff = withStats.avg_views > 0 && withoutStats.avg_views > 0
    ? ((withStats.avg_views - withoutStats.avg_views) / withoutStats.avg_views * 100)
    : 0;

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4 space-y-4 hover:shadow-md transition-shadow">
      {/* 標題區 */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-purple-500/10">
          <Icon className="size-4 text-purple-500" />
        </div>
        <span className="font-semibold">{title}</span>
      </div>

      {/* 對比卡片 - 2 列布局 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 有使用 */}
        <div
          className={cn(
            "relative rounded-xl p-3 border transition-all",
            withBetter
              ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30"
              : "bg-muted/30 border-border/50"
          )}
        >
          {withBetter && (
            <div className="absolute -top-2 -right-2">
              <div className="p-1 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
                <Check className="size-3 text-white" strokeWidth={3} />
              </div>
            </div>
          )}
          <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
            <Check className="size-3" />
            有使用
          </div>
          <div className={cn(
            "text-lg font-bold",
            withBetter ? "text-emerald-600 dark:text-emerald-400" : ""
          )}>
            {formatNumber(withStats.avg_views)}
          </div>
          <div className="text-[11px] text-muted-foreground">{withStats.count} 篇</div>
        </div>

        {/* 未使用 */}
        <div
          className={cn(
            "relative rounded-xl p-3 border transition-all",
            !withBetter
              ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30"
              : "bg-muted/30 border-border/50"
          )}
        >
          {!withBetter && (
            <div className="absolute -top-2 -right-2">
              <div className="p-1 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
                <Check className="size-3 text-white" strokeWidth={3} />
              </div>
            </div>
          )}
          <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
            <X className="size-3" />
            未使用
          </div>
          <div className={cn(
            "text-lg font-bold",
            !withBetter ? "text-emerald-600 dark:text-emerald-400" : ""
          )}>
            {formatNumber(withoutStats.avg_views)}
          </div>
          <div className="text-[11px] text-muted-foreground">{withoutStats.count} 篇</div>
        </div>
      </div>

      {/* 差異 Badge */}
      {Math.abs(diff) > 5 && (
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "text-[11px]",
              withBetter
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
            )}
          >
            <TrendingUp className={cn(
              "size-3 mr-1",
              !withBetter && "rotate-180"
            )} />
            {withBetter ? "使用時" : "不使用時"} {diff > 0 ? "+" : ""}{diff.toFixed(0)}% 曝光
          </Badge>
        </div>
      )}

      {/* 最佳參數 */}
      {(optimalCount !== null && optimalCount !== undefined) && (
        <div className="text-[12px] text-muted-foreground flex items-center gap-1">
          <span>最佳數量：</span>
          <Badge variant="outline" className="text-[11px] px-1.5 py-0">
            {optimalCount} 個
          </Badge>
        </div>
      )}
      {bestType && (
        <div className="text-[12px] text-muted-foreground flex items-center gap-1">
          <span>最佳類型：</span>
          <Badge variant="outline" className="text-[11px] px-1.5 py-0">
            {bestType}
          </Badge>
        </div>
      )}

      {/* 洞察與建議 */}
      <div className="pt-3 border-t space-y-2">
        <div className="flex items-start gap-2">
          <Lightbulb className="size-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-muted-foreground leading-relaxed">{insight}</p>
        </div>
        <p className="text-[12px] font-medium text-purple-600 dark:text-purple-400 pl-5">
          {recommendation}
        </p>
      </div>
    </div>
  );
}

export function FeatureSection({ data, snapshot }: Props) {
  const features = snapshot.content_features;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 shadow-lg shadow-purple-500/25">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">內容特徵效益</h2>
            <p className="text-[13px] text-muted-foreground">
              分析不同內容特徵對表現的影響
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Emoji"
            icon={Smile}
            withStats={features.emoji.with}
            withoutStats={features.emoji.without}
            insight={data.emoji.insight}
            recommendation={data.emoji.recommendation}
            optimalCount={features.emoji.optimal_count}
          />
          <FeatureCard
            title="Hashtag"
            icon={Hash}
            withStats={features.hashtag.with}
            withoutStats={features.hashtag.without}
            insight={data.hashtag.insight}
            recommendation={data.hashtag.recommendation}
            optimalCount={features.hashtag.optimal_count}
          />
          <FeatureCard
            title="連結"
            icon={Link2}
            withStats={features.link.with}
            withoutStats={features.link.without}
            insight={data.question.insight}
            recommendation={data.question.recommendation}
          />
          <FeatureCard
            title="問句"
            icon={HelpCircle}
            withStats={features.question.with}
            withoutStats={features.question.without}
            insight={data.question.insight}
            recommendation={data.question.recommendation}
            bestType={features.question.best_type}
          />
          <FeatureCard
            title="CTA"
            icon={Megaphone}
            withStats={features.cta.with}
            withoutStats={features.cta.without}
            insight={data.cta.insight}
            recommendation={data.cta.recommendation}
            bestType={features.cta.best_type}
          />
        </div>
      </CardContent>
    </Card>
  );
}
