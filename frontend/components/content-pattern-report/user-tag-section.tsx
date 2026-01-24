"use client";

import { Tag, Trophy, Sparkles, Crown, Medal, Award, Eye, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["user_tag_analysis"];
  snapshot: ContentPatternSnapshot;
}

const rankIcons = [Crown, Medal, Award];
const rankColors = [
  "text-amber-500",
  "text-slate-400",
  "text-amber-700",
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function UserTagSection({ data, snapshot }: Props) {
  const userTags = snapshot.user_tags || [];

  // 如果沒有用戶標籤，顯示提示
  if (userTags.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25">
              <Tag className="size-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">自定義標籤效益</h2>
              <p className="text-[13px] text-muted-foreground">
                分析自定義標籤與表現的關聯
              </p>
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/30 p-8 text-center">
            <Tag className="size-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-[14px] text-muted-foreground">
              尚無自定義標籤數據。<br />
              請在貼文管理中為貼文加入自定義標籤。
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 找出最佳表現標籤
  const bestTag = userTags[0];

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25">
            <Tag className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">自定義標籤效益</h2>
            <p className="text-[13px] text-muted-foreground">
              分析自定義標籤與表現的關聯
            </p>
          </div>
        </div>

        {/* 最佳標籤卡片 */}
        {bestTag && (
          <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-teal-500/15 via-teal-500/10 to-cyan-500/5 border-2 border-teal-500/30">
            <div className="absolute top-3 right-3">
              <Trophy className="size-5 text-teal-500/30" />
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-teal-500/20">
                <Trophy className="size-4 text-amber-500" />
              </div>
              <span className="text-[14px] font-semibold text-teal-700 dark:text-teal-400">
                最佳表現標籤
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Badge
                className="text-[14px] px-3 py-1"
                style={{
                  backgroundColor: `${bestTag.color}20`,
                  borderColor: `${bestTag.color}40`,
                  color: bestTag.color,
                }}
              >
                {bestTag.name}
              </Badge>
              <span className="text-[13px] text-muted-foreground">
                平均曝光 {formatNumber(bestTag.avg_views)} | 互動率 {(bestTag.avg_engagement_rate * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* 標籤排行榜 */}
        <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-teal-500" />
            <h3 className="text-[14px] font-semibold">標籤效益排行</h3>
          </div>

          <div className="space-y-2">
            {userTags.slice(0, 10).map((tag, idx) => {
              const RankIcon = rankIcons[idx] || null;
              const rankColor = rankColors[idx] || "text-muted-foreground";

              return (
                <div
                  key={tag.name}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all",
                    idx === 0
                      ? "bg-teal-500/10 border border-teal-500/20"
                      : "bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  {/* 排名 */}
                  <div className="flex-shrink-0 w-8 text-center">
                    {RankIcon ? (
                      <RankIcon className={cn("size-5 mx-auto", rankColor)} />
                    ) : (
                      <span className="text-[13px] font-medium text-muted-foreground">
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* 標籤 */}
                  <Badge
                    variant="secondary"
                    className="text-[12px] px-2 py-0.5"
                    style={{
                      backgroundColor: `${tag.color}15`,
                      borderColor: `${tag.color}30`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </Badge>

                  {/* 數據 */}
                  <div className="ml-auto flex items-center gap-4 text-[12px]">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="size-3" />
                      <span className="font-medium text-foreground">
                        {formatNumber(tag.avg_views)}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {(tag.avg_engagement_rate * 100).toFixed(2)}%
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {tag.count} 篇
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI 分析區 */}
        {data && (
          <div className="mt-6 rounded-2xl border bg-gradient-to-br from-teal-500/5 to-transparent p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-teal-500/10">
                <Sparkles className="size-4 text-teal-500" />
              </div>
              <h3 className="text-[14px] font-semibold">AI 分析</h3>
            </div>
            <p className="text-[14px] leading-relaxed mb-3">{data.summary}</p>

            {data.insights.length > 0 && (
              <ul className="space-y-2 mb-4">
                {data.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-3 text-[13px]">
                    <span className="flex-shrink-0 size-1.5 rounded-full bg-teal-500 mt-2" />
                    <span className="text-muted-foreground">{insight}</span>
                  </li>
                ))}
              </ul>
            )}

            {data.recommendations.length > 0 && (
              <div className="pt-3 border-t">
                <div className="text-[12px] font-medium text-teal-700 dark:text-teal-400 mb-2">
                  建議
                </div>
                <ul className="space-y-1.5">
                  {data.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px]">
                      <span className="text-teal-500">•</span>
                      <span className="text-muted-foreground">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
