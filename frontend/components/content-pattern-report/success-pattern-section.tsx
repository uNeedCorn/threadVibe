"use client";

import { Trophy, Star, Sparkles, Crown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing, semanticColors } from "@/components/report-shared";
import { PostCard } from "./post-card";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";

interface Props {
  data: ContentPatternReportContent["success_formula"];
  snapshot: ContentPatternSnapshot;
}

export function SuccessPatternSection({ data, snapshot }: Props) {
  const topPosts = snapshot.success_patterns.top_posts;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.amber)}>
            <Trophy className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>成功模式識別</h2>
            <p className={typography.caption}>分析高表現貼文的共同特徵</p>
          </div>
        </div>

        {/* 成功公式 */}
        <div className="relative rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5">
          <Star className="absolute top-4 right-4 size-5 text-amber-400/30" />
          <Sparkles className="absolute bottom-4 right-6 size-4 text-amber-400/20" />

          <div className="flex items-center gap-2 mb-3">
            <Star className="size-5 text-amber-600" />
            <span className={cn(typography.sectionTitle, "text-amber-700")}>成功公式</span>
          </div>

          <p className={cn(typography.cardTitle, "text-amber-800 mb-3")}>「{data.pattern}」</p>
          <p className={typography.body}>{data.why_it_works}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：共同特徵 + 成功範例 */}
          <div className={spacing.content}>
            {/* 共同特徵 */}
            {snapshot.success_patterns.common_features.length > 0 && (
              <section className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-5 text-emerald-600" />
                  <h3 className={cn(typography.sectionTitle, "text-emerald-700")}>高表現貼文共同特徵</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {snapshot.success_patterns.common_features.map((feature, idx) => (
                    <Badge key={idx} className={semanticColors.success.badge}>
                      {feature}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* 成功範例摘要 */}
            {data.examples.length > 0 && (
              <section className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="size-5 text-amber-600" />
                  <h3 className={typography.sectionTitle}>成功範例摘要</h3>
                </div>
                <ul className={spacing.list}>
                  {data.examples.map((example, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="shrink-0 size-1.5 rounded-full bg-amber-500 mt-2" />
                      <span className={typography.body}>{example}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* 右側：Top 5 貼文 */}
          {topPosts.length > 0 && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="size-5 text-amber-500" />
                <h3 className={typography.sectionTitle}>Top 5 高表現貼文</h3>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                {topPosts.slice(0, 5).map((post, idx) => (
                  <PostCard key={post.id} post={post} rank={idx + 1} variant="success" />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
