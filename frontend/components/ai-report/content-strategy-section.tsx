"use client";

import { FileText, Lightbulb, Eye, Heart, Sparkles, Crown, Medal, Award, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing, semanticColors } from "@/components/report-shared";

interface ContentStrategyData {
  summary: string;
  findings?: string[];
  top_performing?: string[];
  top_performing_themes?: string[];
  improvement_areas?: string[];
}

interface TopPost {
  id: string;
  text: string;
  views: number;
  likes: number;
  engagement_rate: number;
  published_at: string;
}

interface Props {
  data: ContentStrategyData;
  topPosts: TopPost[];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

const rankConfig = [
  { icon: Crown, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
  { icon: Medal, color: "text-slate-400", bg: "bg-slate-50", border: "border-slate-200" },
  { icon: Award, color: "text-amber-700", bg: "bg-amber-50/50", border: "border-amber-300/50" },
];

export function ContentStrategySection({ data, topPosts }: Props) {
  const findings = data.findings || data.improvement_areas || [];
  const topPerforming = data.top_performing || data.top_performing_themes || [];

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.amber)}>
            <FileText className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>內容策略</h2>
            <p className={typography.caption}>內容表現與主題分析</p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5">
          <Sparkles className="absolute top-4 right-4 size-4 text-amber-400/50" />
          <p className={cn(typography.body, "pr-8")}>{data.summary}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：AI 發現 + 表現優異主題 */}
          <div className={spacing.content}>
            {/* AI 發現 */}
            <section className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="size-5 text-amber-600" />
                <h3 className={typography.sectionTitle}>AI 發現</h3>
              </div>
              <ul className={spacing.list}>
                {findings.map((finding, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="shrink-0 size-1.5 rounded-full bg-amber-500 mt-2" />
                    <span className={typography.body}>{finding}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 表現優異主題 */}
            {topPerforming.length > 0 && (
              <section className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-5 text-emerald-600" />
                  <h3 className={cn(typography.sectionTitle, "text-emerald-700")}>表現優異主題</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topPerforming.map((theme, idx) => (
                    <Badge key={idx} className={semanticColors.success.badge}>
                      {theme}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* 右側：Top 3 貼文 */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="size-5 text-amber-500" />
              <h3 className={typography.sectionTitle}>本期熱門貼文</h3>
            </div>
            <div className={spacing.list}>
              {topPosts.slice(0, 3).map((post, idx) => {
                const config = rankConfig[idx] || rankConfig[2];
                const RankIcon = config.icon;

                return (
                  <div key={post.id} className={cn("rounded-xl border-2 p-4", config.bg, config.border)}>
                    <div className="flex items-start gap-3">
                      <div className={cn("shrink-0 p-2 rounded-xl", idx === 0 ? "bg-amber-500/20" : "bg-muted/50")}>
                        <RankIcon className={cn("size-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2 leading-relaxed">
                          {post.text || "(無文字內容)"}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5">
                            <Eye className="size-3.5 text-blue-500" />
                            <span className={cn("text-xs font-medium", typography.number)}>
                              {formatNumber(post.views)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Heart className="size-3.5 text-pink-500" />
                            <span className={cn("text-xs font-medium", typography.number)}>
                              {formatNumber(post.likes)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="size-3.5 text-emerald-500" />
                            <span className={cn("text-xs font-medium", typography.number)}>
                              {(post.engagement_rate * 100).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
