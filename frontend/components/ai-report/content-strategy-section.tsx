"use client";

import {
  FileText,
  Lightbulb,
  Eye,
  Heart,
  Sparkles,
  Crown,
  Medal,
  Award,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ContentStrategyData {
  summary: string;
  findings?: string[];
  top_performing?: string[];
  // 向後相容舊格式
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
  {
    icon: Crown,
    color: "text-amber-500",
    bg: "bg-gradient-to-br from-amber-500/20 to-amber-600/10",
    border: "border-amber-500/30",
  },
  {
    icon: Medal,
    color: "text-slate-400",
    bg: "bg-gradient-to-br from-slate-400/20 to-slate-500/10",
    border: "border-slate-400/30",
  },
  {
    icon: Award,
    color: "text-amber-700",
    bg: "bg-gradient-to-br from-amber-700/20 to-amber-800/10",
    border: "border-amber-700/30",
  },
];

export function ContentStrategySection({ data, topPosts }: Props) {
  // 向後相容：優先使用新欄位，fallback 到舊欄位
  const findings = data.findings || data.improvement_areas || [];
  const topPerforming = data.top_performing || data.top_performing_themes || [];

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
            <FileText className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">內容策略</h2>
            <p className="text-[13px] text-muted-foreground">
              內容表現與主題分析
            </p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20">
          <div className="absolute top-3 right-3">
            <Sparkles className="size-4 text-amber-500/50" />
          </div>
          <p className="text-[14px] leading-relaxed pr-8">{data.summary}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* AI 發現 & 表現優異主題 */}
          <div className="space-y-5">
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
                    <span className="flex-shrink-0 size-1.5 rounded-full bg-amber-500 mt-2" />
                    <span className="text-[14px] text-foreground/90 leading-relaxed">
                      {finding}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 表現優異主題 */}
            {topPerforming.length > 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <TrendingUp className="size-4 text-emerald-500" />
                  </div>
                  <h3 className="text-[14px] font-semibold">表現優異主題</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topPerforming.map((theme, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="px-3 py-1.5 text-[13px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                    >
                      {theme}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top 3 貼文 */}
          <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="size-4 text-amber-500" />
              <h3 className="text-[14px] font-semibold">本期熱門貼文</h3>
            </div>
            <div className="space-y-3">
              {topPosts.slice(0, 3).map((post, idx) => {
                const config = rankConfig[idx] || rankConfig[2];
                const RankIcon = config.icon;

                return (
                  <div
                    key={post.id}
                    className={cn(
                      "relative overflow-hidden p-4 rounded-xl border transition-all hover:shadow-md",
                      config.bg,
                      config.border
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex-shrink-0 p-2 rounded-xl",
                          idx === 0 ? "bg-amber-500/20" : "bg-muted/50"
                        )}
                      >
                        <RankIcon className={cn("size-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] line-clamp-2 leading-relaxed">
                          {post.text || "(無文字內容)"}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5">
                            <Eye className="size-3.5 text-blue-500" />
                            <span className="text-[12px] font-medium tabular-nums">
                              {formatNumber(post.views)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Heart className="size-3.5 text-pink-500" />
                            <span className="text-[12px] font-medium tabular-nums">
                              {formatNumber(post.likes)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="size-3.5 text-emerald-500" />
                            <span className="text-[12px] font-medium tabular-nums">
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
