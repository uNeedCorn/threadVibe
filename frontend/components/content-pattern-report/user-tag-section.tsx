"use client";

import { Tag, Trophy, Sparkles, Crown, Medal, Award, Eye, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { typography, spacing } from "@/components/report-shared";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["user_tag_analysis"];
  snapshot: ContentPatternSnapshot;
}

const rankIcons = [Crown, Medal, Award];
const rankColors = ["text-amber-500", "text-slate-400", "text-amber-700"];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

const iconGradient = "bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25";

export function UserTagSection({ data, snapshot }: Props) {
  const userTags = snapshot.user_tags || [];

  if (userTags.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", iconGradient)}>
              <Tag className="size-5 text-white" />
            </div>
            <div>
              <h2 className={typography.cardTitle}>自定義標籤效益</h2>
              <p className={typography.caption}>分析自定義標籤與表現的關聯</p>
            </div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-8 text-center">
            <Tag className="size-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className={typography.body}>
              尚無自定義標籤數據。<br />
              請在貼文管理中為貼文加入自定義標籤。
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const bestTag = userTags[0];

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradient)}>
            <Tag className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>自定義標籤效益</h2>
            <p className={typography.caption}>分析自定義標籤與表現的關聯</p>
          </div>
        </div>

        {/* 最佳標籤卡片 */}
        {bestTag && (
          <div className="relative rounded-xl border-2 border-teal-200 bg-teal-50/50 p-5">
            <Trophy className="absolute top-4 right-4 size-5 text-teal-400/30" />

            <div className="flex items-center gap-2 mb-3">
              <Trophy className="size-5 text-amber-500" />
              <span className={cn(typography.sectionTitle, "text-teal-700")}>最佳表現標籤</span>
            </div>

            <div className="flex items-center gap-3">
              <Badge
                className="text-sm px-3 py-1"
                style={{ backgroundColor: `${bestTag.color}20`, borderColor: `${bestTag.color}40`, color: bestTag.color }}
              >
                {bestTag.name}
              </Badge>
              <span className={typography.caption}>
                平均曝光 {formatNumber(bestTag.avg_views)} | 互動率 {(bestTag.avg_engagement_rate * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* 標籤排行榜 */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-5 text-teal-500" />
            <h3 className={typography.sectionTitle}>標籤效益排行</h3>
          </div>

          <div className={spacing.listCompact}>
            {userTags.slice(0, 10).map((tag, idx) => {
              const RankIcon = rankIcons[idx] || null;
              const rankColor = rankColors[idx] || "text-muted-foreground";

              return (
                <div
                  key={tag.name}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all",
                    idx === 0 ? "bg-teal-50/50 border border-teal-200" : "bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <div className="shrink-0 w-8 text-center">
                    {RankIcon ? (
                      <RankIcon className={cn("size-5 mx-auto", rankColor)} />
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">{idx + 1}</span>
                    )}
                  </div>

                  <Badge
                    variant="secondary"
                    className="text-xs px-2 py-0.5"
                    style={{ backgroundColor: `${tag.color}15`, borderColor: `${tag.color}30`, color: tag.color }}
                  >
                    {tag.name}
                  </Badge>

                  <div className="ml-auto flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="size-3" />
                      <span className={cn("font-medium text-foreground", typography.number)}>{formatNumber(tag.avg_views)}</span>
                    </div>
                    <div className={cn("text-muted-foreground", typography.number)}>{(tag.avg_engagement_rate * 100).toFixed(2)}%</div>
                    <Badge variant="outline" className="text-xs">{tag.count} 篇</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI 分析區 */}
        {data && (
          <section className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="size-5 text-amber-600" />
              <h3 className={cn(typography.sectionTitle, "text-amber-700")}>AI 分析</h3>
            </div>
            <p className={cn(typography.body, "mb-3")}>{data.summary}</p>

            {data.insights.length > 0 && (
              <ul className={cn(spacing.listCompact, "mb-4")}>
                {data.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 size-1.5 rounded-full bg-teal-500 mt-2" />
                    <span className={typography.caption}>{insight}</span>
                  </li>
                ))}
              </ul>
            )}

            {data.recommendations.length > 0 && (
              <div className="pt-3 border-t">
                <div className="text-xs font-medium text-teal-700 mb-2">建議</div>
                <ul className="space-y-1.5">
                  {data.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-teal-500">•</span>
                      <span className={typography.caption}>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
