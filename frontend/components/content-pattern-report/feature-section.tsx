"use client";

import { Sparkles, Smile, Hash, Link2, HelpCircle, Megaphone, Check, X, TrendingUp, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, semanticColors } from "@/components/report-shared";
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
    <div className="rounded-xl border bg-muted/30 p-4 space-y-4 hover:shadow-md transition-shadow">
      {/* 標題區 */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-violet-500/10">
          <Icon className="size-4 text-violet-500" />
        </div>
        <span className={typography.sectionTitle}>{title}</span>
      </div>

      {/* 對比卡片 - 2 列布局 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 有使用 */}
        <div
          className={cn(
            "relative rounded-xl p-3 border transition-all",
            withBetter
              ? "bg-emerald-50/50 border-emerald-200"
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
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Check className="size-3" />
            有使用
          </div>
          <div className={cn(
            "text-lg font-bold",
            withBetter ? "text-emerald-600" : ""
          )}>
            {formatNumber(withStats.avg_views)}
          </div>
          <div className="text-xs text-muted-foreground">{withStats.count} 篇</div>
        </div>

        {/* 未使用 */}
        <div
          className={cn(
            "relative rounded-xl p-3 border transition-all",
            !withBetter
              ? "bg-emerald-50/50 border-emerald-200"
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
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <X className="size-3" />
            未使用
          </div>
          <div className={cn(
            "text-lg font-bold",
            !withBetter ? "text-emerald-600" : ""
          )}>
            {formatNumber(withoutStats.avg_views)}
          </div>
          <div className="text-xs text-muted-foreground">{withoutStats.count} 篇</div>
        </div>
      </div>

      {/* 差異 Badge */}
      {Math.abs(diff) > 5 && (
        <div className="flex items-center gap-2">
          <Badge className={withBetter ? semanticColors.success.badge : semanticColors.error.badge}>
            <TrendingUp className={cn("size-3 mr-1", !withBetter && "rotate-180")} />
            {withBetter ? "使用時" : "不使用時"} {diff > 0 ? "+" : ""}{diff.toFixed(0)}% 曝光
          </Badge>
        </div>
      )}

      {/* 最佳參數 */}
      {(optimalCount !== null && optimalCount !== undefined) && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <span>最佳數量：</span>
          <Badge variant="outline" className="text-xs px-1.5 py-0">{optimalCount} 個</Badge>
        </div>
      )}
      {bestType && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <span>最佳類型：</span>
          <Badge variant="outline" className="text-xs px-1.5 py-0">{bestType}</Badge>
        </div>
      )}

      {/* 洞察與建議 */}
      <div className="pt-3 border-t space-y-2">
        <div className="flex items-start gap-2">
          <Lightbulb className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className={typography.caption}>{insight}</p>
        </div>
        <p className="text-sm font-medium text-violet-600 pl-5">{recommendation}</p>
      </div>
    </div>
  );
}

export function FeatureSection({ data, snapshot }: Props) {
  const features = snapshot.content_features;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.purple)}>
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>內容特徵效益</h2>
            <p className={typography.caption}>分析不同內容特徵對表現的影響</p>
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
