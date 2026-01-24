"use client";

import { Trophy, Star, Sparkles, Crown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PostCard } from "./post-card";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["success_formula"];
  snapshot: ContentPatternSnapshot;
}

export function SuccessPatternSection({ data, snapshot }: Props) {
  const topPosts = snapshot.success_patterns.top_posts;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
            <Trophy className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">成功模式識別</h2>
            <p className="text-[13px] text-muted-foreground">
              分析高表現貼文的共同特徵
            </p>
          </div>
        </div>

        {/* 成功公式 - 金色漸層卡片 */}
        <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-orange-500/5 border-2 border-amber-500/30">
          <div className="absolute top-3 right-3">
            <Star className="size-5 text-amber-500/30" />
          </div>
          <div className="absolute bottom-3 right-6">
            <Sparkles className="size-4 text-amber-500/20" />
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-amber-500/20">
              <Star className="size-4 text-amber-500" />
            </div>
            <span className="text-[14px] font-semibold text-amber-700 dark:text-amber-400">
              成功公式
            </span>
          </div>

          <p className="text-xl font-bold text-amber-800 dark:text-amber-300 mb-3">
            「{data.pattern}」
          </p>

          <p className="text-[14px] text-foreground/80 leading-relaxed">
            {data.why_it_works}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：共同特徵 + 成功範例 */}
          <div className="space-y-5">
            {/* 共同特徵標籤牆 */}
            {snapshot.success_patterns.common_features.length > 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <TrendingUp className="size-4 text-emerald-500" />
                  </div>
                  <h3 className="text-[14px] font-semibold">高表現貼文共同特徵</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {snapshot.success_patterns.common_features.map((feature, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="px-3 py-1.5 text-[13px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                    >
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 成功範例摘要 */}
            {data.examples.length > 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-amber-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <Sparkles className="size-4 text-amber-500" />
                  </div>
                  <h3 className="text-[14px] font-semibold">成功範例摘要</h3>
                </div>
                <ul className="space-y-2.5">
                  {data.examples.map((example, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex-shrink-0 size-1.5 rounded-full bg-amber-500 mt-2" />
                      <span className="text-[14px] text-foreground/80 leading-relaxed">
                        {example}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 右側：Top 5 貼文 */}
          {topPosts.length > 0 && (
            <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="size-4 text-amber-500" />
                <h3 className="text-[14px] font-semibold">Top 5 高表現貼文</h3>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                {topPosts.slice(0, 5).map((post, idx) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    rank={idx + 1}
                    variant="success"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
